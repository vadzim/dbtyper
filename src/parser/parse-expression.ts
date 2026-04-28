import type { JsqlDatabaseShape } from "../../core/jsql-shapes.ts"
import type {
	PeekToken,
	ReadToken,
	SkipToken,
	SqlParserError,
	TokenIdent,
	TokenKey,
	TokenNumber,
	TokenParam,
	TokenString,
	TokensList,
} from "../../core/sql-tokens.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { CatalogAccessMode, ResolveColumnRefValue } from "./resolve-column-ref.ts"
import type { SkipBracketedUntil } from "./skip-statement.ts"

/** Caller-supplied `:name` bindings (names must match lexer param identifiers). */
export type ExpressionParamsShape = Record<string, { ts: unknown; sql: string }>

/** Default `Params` for parsers: `keyof` is `never` (plain `{}` widens against `Record<string, …>`). */
export type EmptyExpressionParams = Record<never, never>

export type ExpressionParseContext<
	Cat extends CatalogAccessMode = CatalogAccessMode,
	Params extends ExpressionParamsShape = ExpressionParamsShape,
> = {
	catalogAccess: Cat
	params: Params
}

type SqlUnbalancedParens = SqlParserError<"Unbalanced parentheses">

type SqlUnsupportedParenExpr = SqlParserError<"Unsupported parenthesized expression">

/** Operand parsed to a value that is not a boolean (e.g. bare column, numeric comparison used as AND input). */
type SqlExprMustBeBoolean = SqlParserError<"Expression must be boolean">

/** True when `T` is `unknown` or `any` (not other types). */
export type IsUnknownOrAny<T> = 0 extends 1 & T ? true : unknown extends T ? (T extends unknown ? true : false) : false

export type ExprOk<Ts, Sql extends string> = { ok: true; ts: Ts; sql: Sql }

/** SQL `NULL` literal — may only appear in `IS [NOT] NULL`, not in `=` / `<>`. */
export type ExprSqlNull = { ok: true; ts: null; sql: "null"; exprKind: "sql_null" }

export type ExprAtom = ExprOk<unknown, string> | ExprSqlNull

/** Identifier chain in a scalar expression AST (syntax only until {@link ResolveScalarExprAst}). */
export type ScalarIdentParts = readonly [string] | readonly [string, string] | readonly [string, string, string]

/** Scalar expression without `Db` / `Scope` (SELECT list and tests); resolve with {@link ResolveScalarExprAst}. */
export type ScalarExprAst =
	| { kind: "true" }
	| { kind: "false" }
	| { kind: "sql_null" }
	| { kind: "string"; value: string }
	| { kind: "number"; raw: string }
	| { kind: "param"; name: string }
	| { kind: "col"; parts: ScalarIdentParts }
	| { kind: "neg"; inner: ScalarExprAst }
	| { kind: "add"; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "sub"; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "mul"; left: ScalarExprAst; right: ScalarExprAst }

/** Longest `a` / `a.b` / `a.b.c` chain starting at an identifier (used by SELECT list fast path). */
export type MaximalIdentChain<Tokens extends TokensList> =
	ReadToken<Tokens> extends [infer R1 extends TokensList, TokenIdent<infer A extends string>]
		? PeekToken<R1> extends TokenKey<".">
			? ReadToken<R1> extends [infer R2 extends TokensList, TokenKey<".">]
				? ReadToken<R2> extends [infer R3 extends TokensList, TokenIdent<infer B extends string>]
					? PeekToken<R3> extends TokenKey<".">
						? ReadToken<R3> extends [infer R4 extends TokensList, TokenKey<".">]
							? ReadToken<R4> extends [infer R5 extends TokensList, TokenIdent<infer C extends string>]
								? [R5, readonly [A, B, C]]
								: never
							: never
						: [R3, readonly [A, B]]
					: never
				: never
			: [R1, readonly [A]]
		: never

type LookupParam<Params extends ExpressionParamsShape, Name extends string> = Name extends keyof Params
	? IsUnknownOrAny<Params[Name]["ts"]> extends true
		? SqlParserError<"Parameter has unknown or any type">
		: ExprOk<Params[Name]["ts"], Params[Name]["sql"]>
	: SqlParserError<"Unknown query parameter">

type ResolveIdentChainValue<
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Parts extends readonly [string] | readonly [string, string] | readonly [string, string, string],
	Ctx extends ExpressionParseContext,
> =
	ResolveColumnRefValue<Db, Scope, Parts, Ctx["catalogAccess"]> extends infer V
		? V extends SqlParserError<string>
			? V
			: V extends { ts: infer Ts; sql: infer Sql extends string }
				? ExprOk<Ts, Sql>
				: SqlParserError<"Invalid column reference">
		: never

type TryOperandIdentColumnRefBody<
	Rm extends TokensList,
	Parts extends readonly string[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> = Parts extends readonly [infer S extends string, infer T extends string, infer C extends string]
	? ResolveIdentChainValue<Db, Scope, readonly [S, T, C], Ctx> extends infer V
		? V extends SqlParserError<string>
			? [Rm, V]
			: V extends ExprOk<infer Ts, infer Sql extends string>
				? [Rm, V]
				: never
		: never
	: Parts extends readonly [infer A extends string, infer C2 extends string]
		? ResolveIdentChainValue<Db, Scope, readonly [A, C2], Ctx> extends infer V2
			? V2 extends SqlParserError<string>
				? [Rm, V2]
				: V2 extends ExprOk<infer Ts2, infer Sql2 extends string>
					? [Rm, V2]
					: never
			: never
		: Parts extends readonly [infer C1 extends string]
			? ResolveIdentChainValue<Db, Scope, readonly [C1], Ctx> extends infer V1
				? V1 extends SqlParserError<string>
					? [Rm, V1]
					: V1 extends ExprOk<infer Ts1, infer Sql1 extends string>
						? [Rm, V1]
						: never
				: never
			: never

type TryOperandIdentOrCall<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> =
	MaximalIdentChain<Tokens> extends [infer Rm extends TokensList, infer Parts extends readonly string[]]
		? PeekToken<Rm> extends TokenKey<"(">
			? SkipBracketedUntil<SkipToken<Rm>, TokenKey<")">> extends [infer After extends TokensList, infer Rs]
				? Rs extends SqlParserError<string>
					? [After, SqlUnbalancedParens]
					: [After, SqlUnsupportedParenExpr]
				: never
			: TryOperandIdentColumnRefBody<Rm, Parts, Db, Scope, Ctx>
		: never

type SameComparisonClass<TsL, TsR> = TsL extends boolean
	? TsR extends boolean
		? true
		: false
	: TsL extends string
		? TsR extends string
			? true
			: false
		: TsL extends number
			? TsR extends number
				? true
				: false
			: TsL extends bigint
				? TsR extends bigint
					? true
					: false
				: false

type MergeComparison<L extends ExprAtom, R extends ExprAtom> = L extends ExprSqlNull
	? SqlParserError<"Use IS NULL instead of = null">
	: R extends ExprSqlNull
		? SqlParserError<"Use IS NULL instead of = null">
		: L extends ExprOk<infer TsL, infer _Sl>
			? R extends ExprOk<infer TsR, infer _Sr>
				? SameComparisonClass<TsL, TsR> extends true
					? ExprOk<boolean, "boolean">
					: SqlParserError<"Incompatible types in comparison">
				: never
			: never

type TryOperandTyped<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> =
	PeekToken<Tokens> extends TokenKey<"(">
		? SkipBracketedUntil<SkipToken<Tokens>, TokenKey<")">> extends [infer AfterSp extends TokensList, infer Rs]
			? Rs extends SqlParserError<string>
				? [AfterSp, SqlUnbalancedParens]
				: [AfterSp, SqlUnsupportedParenExpr]
			: never
		: PeekToken<Tokens> extends TokenKey<"true">
			? ReadToken<Tokens> extends [infer R extends TokensList, TokenKey<"true">]
				? [R, ExprOk<true, "boolean">]
				: never
			: PeekToken<Tokens> extends TokenKey<"false">
				? ReadToken<Tokens> extends [infer Rf extends TokensList, TokenKey<"false">]
					? [Rf, ExprOk<false, "boolean">]
					: never
				: PeekToken<Tokens> extends TokenKey<"null">
					? ReadToken<Tokens> extends [infer Rn extends TokensList, TokenKey<"null">]
						? [Rn, ExprSqlNull]
						: never
					: PeekToken<Tokens> extends TokenString<string>
						? ReadToken<Tokens> extends [infer Rs extends TokensList, unknown]
							? [Rs, ExprOk<string, "text">]
							: never
						: PeekToken<Tokens> extends TokenNumber<string>
							? ReadToken<Tokens> extends [infer Rn extends TokensList, unknown]
								? [Rn, ExprOk<number, "number">]
								: never
							: PeekToken<Tokens> extends TokenParam<infer P extends string>
								? ReadToken<Tokens> extends [infer Rp extends TokensList, unknown]
									? LookupParam<Ctx["params"], P> extends infer PV
										? PV extends SqlParserError<string>
											? [Rp, PV]
											: PV extends ExprOk<infer Tsp, infer SqlP extends string>
												? [Rp, ExprOk<Tsp, SqlP>]
												: never
										: never
									: never
								: PeekToken<Tokens> extends TokenIdent<string>
									? TryOperandIdentOrCall<Tokens, Db, Scope, Ctx>
									: ReadToken<Tokens> extends [infer Rbad extends TokensList, infer _TokU]
										? [Rbad, SqlParserError<"Unexpected token">]
										: never

type IsRelOp<T> =
	T extends TokenKey<"=">
		? true
		: T extends TokenKey<"<>">
			? true
			: T extends TokenKey<"!=">
				? true
				: T extends TokenKey<"<=">
					? true
					: T extends TokenKey<">=">
						? true
						: T extends TokenKey<"<">
							? true
							: T extends TokenKey<">">
								? true
								: false

type ParseAfterOperandTyped<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
	Lhs extends ExprAtom,
> =
	PeekToken<Tokens> extends infer P
		? IsRelOp<P> extends true
			? ReadToken<Tokens> extends [infer R2 extends TokensList, unknown]
				? TryOperandTyped<R2, Db, Scope, Ctx> extends [infer R3 extends TokensList, infer Rhs]
					? Rhs extends SqlParserError<string>
						? [R3, Rhs]
						: Rhs extends ExprAtom
							? MergeComparison<Lhs, Rhs> extends infer M
								? M extends SqlParserError<string>
									? [R3, M]
									: M extends ExprOk<boolean, "boolean">
										? [R3, M]
										: never
								: never
							: never
					: never
				: never
			: ParseAfterOperandNoRel<Tokens, Lhs, P>
		: never

type ParseAfterIs<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"not">
		? ReadToken<Tokens> extends [infer R5 extends TokensList, TokenKey<"not">]
			? PeekToken<R5> extends TokenKey<"null">
				? ReadToken<R5> extends [infer R6 extends TokensList, TokenKey<"null">]
					? [R6, ExprOk<boolean, "boolean">]
					: ReadToken<R5> extends [infer R5b extends TokensList, infer _TokN]
						? [R5b, SqlParserError<"Expected NULL after IS NOT">]
						: never
				: [R5, SqlParserError<"Expected NULL after IS NOT">]
			: never
		: PeekToken<Tokens> extends TokenKey<"null">
			? ReadToken<Tokens> extends [infer R7 extends TokensList, TokenKey<"null">]
				? [R7, ExprOk<boolean, "boolean">]
				: never
			: [Tokens, SqlParserError<"Expected NULL after IS">]

type ParseAfterOperandNoRel<Tokens extends TokensList, Lhs extends ExprAtom, P> =
	P extends TokenKey<"is">
		? ReadToken<Tokens> extends [infer R4 extends TokensList, TokenKey<"is">]
			? ParseAfterIs<R4>
			: never
		: P extends TokenKey<"in">
			? ReadToken<Tokens> extends [infer R8 extends TokensList, TokenKey<"in">]
				? PeekToken<R8> extends TokenKey<"(">
					? SkipBracketedUntil<SkipToken<R8>, TokenKey<")">> extends [infer R9 extends TokensList, infer Rs]
						? Rs extends SqlParserError<string>
							? [R9, SqlParserError<"Unbalanced parentheses IN">]
							: [R9, ExprOk<boolean, "boolean">]
						: never
					: [R8, SqlParserError<"Expected `(` after IN">]
				: never
			: [Tokens, Lhs]

type ParsePrimaryTyped<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> =
	PeekToken<Tokens> extends TokenKey<"(">
		? ReadToken<Tokens> extends [infer Ri extends TokensList, TokenKey<"(">]
			? ParseOrEntry<Ri, Db, Scope, Ctx> extends [infer Rj extends TokensList, infer Ej]
				? Ej extends SqlParserError<string>
					? [Rj, Ej]
					: ReadToken<Rj> extends [infer Rk extends TokensList, infer TokCl]
						? TokCl extends TokenKey<")">
							? Ej extends ExprAtom
								? [Rk, Ej]
								: never
							: [Rk, SqlParserError<"Expected `)`">]
						: never
				: never
			: never
		: TryOperandTyped<Tokens, Db, Scope, Ctx> extends [infer R1 extends TokensList, infer E1]
			? E1 extends SqlParserError<string>
				? [R1, E1]
				: E1 extends ExprAtom
					? ParseAfterOperandTyped<R1, Db, Scope, Ctx, E1>
					: never
			: never

type ParseUnaryTyped<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> =
	PeekToken<Tokens> extends TokenKey<"not">
		? ReadToken<Tokens> extends [infer Rn extends TokensList, TokenKey<"not">]
			? ParseUnaryTyped<Rn, Db, Scope, Ctx> extends [infer Ru extends TokensList, infer U]
				? U extends SqlParserError<string>
					? [Ru, U]
					: U extends ExprOk<infer Tu, infer Su>
						? Tu extends boolean
							? [Ru, ExprOk<boolean, "boolean">]
							: [Ru, SqlExprMustBeBoolean]
						: never
				: never
			: never
		: ParsePrimaryTyped<Tokens, Db, Scope, Ctx>

type ParseAndLoopAfterFirst<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> =
	PeekToken<Tokens> extends TokenKey<"and">
		? ReadToken<Tokens> extends [infer R1 extends TokensList, TokenKey<"and">]
			? ParseUnaryTyped<R1, Db, Scope, Ctx> extends [infer R2 extends TokensList, infer E1]
				? E1 extends SqlParserError<string>
					? [R2, E1]
					: E1 extends ExprOk<infer T1, infer _S1>
						? T1 extends boolean
							? ParseAndLoopAfterFirst<R2, Db, Scope, Ctx>
							: [R2, SqlExprMustBeBoolean]
						: never
				: never
			: never
		: [Tokens, ExprOk<boolean, "boolean">]

type ParseAndTyped<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> =
	ParseUnaryTyped<Tokens, Db, Scope, Ctx> extends [infer R0 extends TokensList, infer E0]
		? E0 extends SqlParserError<string>
			? [R0, E0]
			: E0 extends ExprOk<infer T0, infer _S0>
				? T0 extends boolean
					? ParseAndLoopAfterFirst<R0, Db, Scope, Ctx>
					: [R0, SqlExprMustBeBoolean]
				: never
		: never

type ParseOrLoopAfterFirst<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> =
	PeekToken<Tokens> extends TokenKey<"or">
		? ReadToken<Tokens> extends [infer R1 extends TokensList, TokenKey<"or">]
			? ParseAndTyped<R1, Db, Scope, Ctx> extends [infer R2 extends TokensList, infer E1]
				? E1 extends SqlParserError<string>
					? [R2, E1]
					: E1 extends ExprOk<infer T1, infer _S1>
						? T1 extends boolean
							? ParseOrLoopAfterFirst<R2, Db, Scope, Ctx>
							: [R2, SqlExprMustBeBoolean]
						: never
				: never
			: never
		: [Tokens, ExprOk<boolean, "boolean">]

type SqlIncompatibleArithmetic = SqlParserError<"Incompatible types in arithmetic">

type SqlNullInArithmetic = SqlParserError<"NULL not allowed in arithmetic">

type SqlUnaryMinusNonNumber = SqlParserError<"Unary minus requires a number">

type MergeNumericArithmetic<L extends ExprAtom, R extends ExprAtom> = L extends ExprSqlNull
	? SqlNullInArithmetic
	: R extends ExprSqlNull
		? SqlNullInArithmetic
		: L extends ExprOk<infer TsL, infer _Sl>
			? R extends ExprOk<infer TsR, infer _Sr>
				? TsL extends number
					? TsR extends number
						? ExprOk<number, "number">
						: SqlIncompatibleArithmetic
					: SqlIncompatibleArithmetic
				: never
			: never

type ScalarAstNonNumericForMulHead<E extends ScalarExprAst> = E extends { kind: "string" }
	? true
	: E extends { kind: "true" }
		? true
		: E extends { kind: "false" }
			? true
			: E extends { kind: "sql_null" }
				? true
				: E extends { kind: "neg"; inner: infer I extends ScalarExprAst }
					? ScalarAstNonNumericForMulHead<I>
					: false

type TryOperandScalarUntyped<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"(">
		? ReadToken<Tokens> extends [infer Ri extends TokensList, TokenKey<"(">]
			? ParseScalarExprUntyped<Ri> extends [infer Rj extends TokensList, infer Ej]
				? Ej extends SqlParserError<string>
					? [Rj, Ej]
					: ReadToken<Rj> extends [infer Rk extends TokensList, infer TokCl]
						? TokCl extends TokenKey<")">
							? [Rk, Ej]
							: [Rk, SqlParserError<"Expected `)`">]
						: never
				: never
			: never
		: PeekToken<Tokens> extends TokenKey<"true">
			? ReadToken<Tokens> extends [infer Rt extends TokensList, TokenKey<"true">]
				? [Rt, { kind: "true" }]
				: never
			: PeekToken<Tokens> extends TokenKey<"false">
				? ReadToken<Tokens> extends [infer Rf extends TokensList, TokenKey<"false">]
					? [Rf, { kind: "false" }]
					: never
				: PeekToken<Tokens> extends TokenKey<"null">
					? ReadToken<Tokens> extends [infer Rn extends TokensList, TokenKey<"null">]
						? [Rn, { kind: "sql_null" }]
						: never
					: PeekToken<Tokens> extends TokenString<infer Str>
						? ReadToken<Tokens> extends [infer Rs extends TokensList, TokenString<Str>]
							? [Rs, { kind: "string"; value: Str }]
							: never
						: PeekToken<Tokens> extends TokenNumber<infer Raw>
							? ReadToken<Tokens> extends [infer Rnum extends TokensList, TokenNumber<Raw>]
								? [Rnum, { kind: "number"; raw: Raw }]
								: never
							: PeekToken<Tokens> extends TokenParam<infer P extends string>
								? ReadToken<Tokens> extends [infer Rp extends TokensList, unknown]
									? [Rp, { kind: "param"; name: P }]
									: never
								: ReadToken<Tokens> extends [infer Rbad extends TokensList, infer _TokU]
									? [Rbad, SqlParserError<"Unexpected token">]
									: never

type ParseUnaryScalarUntyped<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"-">
		? ReadToken<Tokens> extends [infer Rn extends TokensList, TokenKey<"-">]
			? ParseUnaryScalarUntyped<Rn> extends [infer Ru extends TokensList, infer U]
				? U extends SqlParserError<string>
					? [Ru, U]
					: U extends ScalarExprAst
						? [Ru, { kind: "neg"; inner: U }]
						: never
				: never
			: never
		: TryOperandScalarUntyped<Tokens>

type ParseMulLoopAfterFirstScalarUntyped<Tokens extends TokensList, Acc extends ScalarExprAst> =
	PeekToken<Tokens> extends TokenKey<"*">
		? ReadToken<Tokens> extends [infer R1 extends TokensList, TokenKey<"*">]
			? ParseUnaryScalarUntyped<R1> extends [infer R2 extends TokensList, infer E1]
				? E1 extends SqlParserError<string>
					? [R2, E1]
					: E1 extends ScalarExprAst
						? ParseMulLoopAfterFirstScalarUntyped<R2, { kind: "mul"; left: Acc; right: E1 }>
						: never
				: never
			: never
		: [Tokens, Acc]

type ParseMulScalarUntypedEntry<Tokens extends TokensList> =
	ParseUnaryScalarUntyped<Tokens> extends [infer R0 extends TokensList, infer E0]
		? E0 extends SqlParserError<string>
			? [R0, E0]
			: E0 extends ScalarExprAst
				? ScalarAstNonNumericForMulHead<E0> extends true
					? PeekToken<R0> extends infer P
						? P extends TokenKey<"+"> | TokenKey<"-"> | TokenKey<"*">
							? [R0, SqlIncompatibleArithmetic]
							: [R0, E0]
						: never
					: ParseMulLoopAfterFirstScalarUntyped<R0, E0>
				: never
		: never

type ParseAddLoopAfterPlusScalarUntyped<Tokens extends TokensList, Acc extends ScalarExprAst> =
	ReadToken<Tokens> extends [infer R1 extends TokensList, TokenKey<"+">]
		? ParseMulScalarUntypedEntry<R1> extends [infer R2 extends TokensList, infer E1]
			? E1 extends SqlParserError<string>
				? [R2, E1]
				: E1 extends ScalarExprAst
					? ParseAddLoopAfterFirstScalarUntyped<R2, MergeScalarAstAddSub<"add", Acc, E1>>
					: never
			: never
		: never

type ParseAddLoopAfterMinusScalarUntyped<Tokens extends TokensList, Acc extends ScalarExprAst> =
	ReadToken<Tokens> extends [infer R3 extends TokensList, TokenKey<"-">]
		? ParseMulScalarUntypedEntry<R3> extends [infer R4 extends TokensList, infer E2]
			? E2 extends SqlParserError<string>
				? [R4, E2]
				: E2 extends ScalarExprAst
					? ParseAddLoopAfterFirstScalarUntyped<R4, MergeScalarAstAddSub<"sub", Acc, E2>>
					: never
			: never
		: never

type MergeScalarAstAddSub<Op extends "add" | "sub", L extends ScalarExprAst, R extends ScalarExprAst> = Op extends "add"
	? { kind: "add"; left: L; right: R }
	: { kind: "sub"; left: L; right: R }

type ParseAddLoopAfterFirstScalarUntyped<Tokens extends TokensList, Acc extends ScalarExprAst> =
	PeekToken<Tokens> extends TokenKey<"+">
		? ParseAddLoopAfterPlusScalarUntyped<Tokens, Acc>
		: PeekToken<Tokens> extends TokenKey<"-">
			? ParseAddLoopAfterMinusScalarUntyped<Tokens, Acc>
			: [Tokens, Acc]

type ParseScalarExprUntypedFromIdent<Tokens extends TokensList> =
	MaximalIdentChain<Tokens> extends [infer Rm extends TokensList, infer Parts extends readonly string[]]
		? PeekToken<Rm> extends TokenKey<"(">
			? SkipBracketedUntil<SkipToken<Rm>, TokenKey<")">> extends [infer After extends TokensList, infer Rs]
				? Rs extends SqlParserError<string>
					? [After, SqlUnbalancedParens]
					: [After, SqlUnsupportedParenExpr]
				: never
			: Parts extends ScalarIdentParts
				? PeekToken<Rm> extends infer Pa
					? Pa extends TokenKey<"+"> | TokenKey<"-"> | TokenKey<"*">
						? ParseAddLoopAfterFirstScalarUntyped<Rm, { kind: "col"; parts: Parts }>
						: [Rm, { kind: "col"; parts: Parts }]
					: never
				: never
		: never

type ParseScalarExprUntypedNonIdent<Tokens extends TokensList> =
	ParseMulScalarUntypedEntry<Tokens> extends [infer R0 extends TokensList, infer E0]
		? E0 extends SqlParserError<string>
			? [R0, E0]
			: E0 extends ScalarExprAst
				? ScalarAstNonNumericForMulHead<E0> extends true
					? PeekToken<R0> extends infer P
						? P extends TokenKey<"+"> | TokenKey<"-"> | TokenKey<"*">
							? [R0, SqlIncompatibleArithmetic]
							: [R0, E0]
						: never
					: ParseAddLoopAfterFirstScalarUntyped<R0, E0>
				: never
		: never

/** Token-only scalar expression (`+` `-` `*` unary `-`, literals, `:param`, `a.b.c`); no column typing. */
export type ParseScalarExprUntyped<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenIdent<string>
		? ParseScalarExprUntypedFromIdent<Tokens>
		: ParseScalarExprUntypedNonIdent<Tokens>

type ResolveScalarExprAstPair<
	L extends ScalarExprAst,
	R extends ScalarExprAst,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> =
	ResolveScalarExprAst<L, Db, Scope, Ctx> extends infer Lv
		? Lv extends SqlParserError<string>
			? Lv
			: ResolveScalarExprAst<R, Db, Scope, Ctx> extends infer Rv
				? Rv extends SqlParserError<string>
					? Rv
					: Lv extends ExprAtom
						? Rv extends ExprAtom
							? MergeNumericArithmetic<Lv, Rv>
							: SqlParserError<"Invalid arithmetic operand">
						: SqlParserError<"Invalid arithmetic operand">
				: never
		: never

type ResolveScalarExprAstNeg<
	I extends ScalarExprAst,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> =
	ResolveScalarExprAst<I, Db, Scope, Ctx> extends infer U
		? U extends SqlParserError<string>
			? U
			: U extends ExprOk<number, infer _Sn>
				? ExprOk<number, "number">
				: SqlUnaryMinusNonNumber
		: never

/** Resolve {@link ScalarExprAst} after `FROM` scope is known; same rules as {@link ParseAddValue}. */
export type ResolveScalarExprAst<
	Ast,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> = Ast extends { kind: "true" }
	? ExprOk<true, "boolean">
	: Ast extends { kind: "false" }
		? ExprOk<false, "boolean">
		: Ast extends { kind: "sql_null" }
			? ExprSqlNull
			: Ast extends { kind: "string"; value: string }
				? ExprOk<string, "text">
				: Ast extends { kind: "number"; raw: string }
					? ExprOk<number, "number">
					: Ast extends { kind: "param"; name: infer N extends string }
						? LookupParam<Ctx["params"], N>
						: Ast extends { kind: "col"; parts: infer P extends ScalarIdentParts }
							? ResolveIdentChainValue<Db, Scope, P, Ctx>
							: Ast extends { kind: "neg"; inner: infer I extends ScalarExprAst }
								? ResolveScalarExprAstNeg<I, Db, Scope, Ctx>
								: Ast extends {
											kind: "mul"
											left: infer L extends ScalarExprAst
											right: infer R extends ScalarExprAst
									  }
									? ResolveScalarExprAstPair<L, R, Db, Scope, Ctx>
									: Ast extends {
												kind: "add"
												left: infer La extends ScalarExprAst
												right: infer Ra extends ScalarExprAst
										  }
										? ResolveScalarExprAstPair<La, Ra, Db, Scope, Ctx>
										: Ast extends {
													kind: "sub"
													left: infer Ls extends ScalarExprAst
													right: infer Rs extends ScalarExprAst
											  }
											? ResolveScalarExprAstPair<Ls, Rs, Db, Scope, Ctx>
											: SqlParserError<"Invalid scalar expression">

/** Operand for scalar `+` / `-` / `*` (parenthesized subexpression is a value, not a boolean `OR` chain). */
type TryValueOperand<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> =
	PeekToken<Tokens> extends TokenKey<"(">
		? ReadToken<Tokens> extends [infer Ri extends TokensList, TokenKey<"(">]
			? ParseAddValue<Ri, Db, Scope, Ctx> extends [infer Rj extends TokensList, infer Ej]
				? Ej extends SqlParserError<string>
					? [Rj, Ej]
					: ReadToken<Rj> extends [infer Rk extends TokensList, infer TokCl]
						? TokCl extends TokenKey<")">
							? Ej extends ExprAtom
								? [Rk, Ej]
								: never
							: [Rk, SqlParserError<"Expected `)`">]
						: never
				: never
			: never
		: PeekToken<Tokens> extends TokenKey<"true">
			? ReadToken<Tokens> extends [infer R extends TokensList, TokenKey<"true">]
				? [R, ExprOk<true, "boolean">]
				: never
			: PeekToken<Tokens> extends TokenKey<"false">
				? ReadToken<Tokens> extends [infer Rf extends TokensList, TokenKey<"false">]
					? [Rf, ExprOk<false, "boolean">]
					: never
				: PeekToken<Tokens> extends TokenKey<"null">
					? ReadToken<Tokens> extends [infer Rn extends TokensList, TokenKey<"null">]
						? [Rn, ExprSqlNull]
						: never
					: PeekToken<Tokens> extends TokenString<string>
						? ReadToken<Tokens> extends [infer Rs extends TokensList, unknown]
							? [Rs, ExprOk<string, "text">]
							: never
						: PeekToken<Tokens> extends TokenNumber<string>
							? ReadToken<Tokens> extends [infer Rnum extends TokensList, unknown]
								? [Rnum, ExprOk<number, "number">]
								: never
							: PeekToken<Tokens> extends TokenParam<infer P extends string>
								? ReadToken<Tokens> extends [infer Rp extends TokensList, unknown]
									? LookupParam<Ctx["params"], P> extends infer PV
										? PV extends SqlParserError<string>
											? [Rp, PV]
											: PV extends ExprOk<infer Tsp, infer SqlP extends string>
												? [Rp, ExprOk<Tsp, SqlP>]
												: never
										: never
									: never
								: PeekToken<Tokens> extends TokenIdent<string>
									? TryOperandIdentOrCall<Tokens, Db, Scope, Ctx>
									: ReadToken<Tokens> extends [infer Rbad extends TokensList, infer _TokU]
										? [Rbad, SqlParserError<"Unexpected token">]
										: never

type ParsePrimaryValue<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> = TryValueOperand<Tokens, Db, Scope, Ctx>

type ParseUnaryValue<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> =
	PeekToken<Tokens> extends TokenKey<"-">
		? ReadToken<Tokens> extends [infer Rn extends TokensList, TokenKey<"-">]
			? ParseUnaryValue<Rn, Db, Scope, Ctx> extends [infer Ru extends TokensList, infer U]
				? U extends SqlParserError<string>
					? [Ru, U]
					: U extends ExprOk<infer Tu, infer Su>
						? Tu extends number
							? [Ru, ExprOk<number, "number">]
							: [Ru, SqlUnaryMinusNonNumber]
						: never
				: never
			: never
		: ParsePrimaryValue<Tokens, Db, Scope, Ctx>

type ParseMulLoopAfterFirst<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
	Acc extends ExprOk<number, string>,
> =
	PeekToken<Tokens> extends TokenKey<"*">
		? ReadToken<Tokens> extends [infer R1 extends TokensList, TokenKey<"*">]
			? ParseUnaryValue<R1, Db, Scope, Ctx> extends [infer R2 extends TokensList, infer E1]
				? E1 extends SqlParserError<string>
					? [R2, E1]
					: E1 extends ExprAtom
						? MergeNumericArithmetic<Acc, E1> extends infer M
							? M extends SqlParserError<string>
								? [R2, M]
								: M extends ExprOk<number, "number">
									? ParseMulLoopAfterFirst<R2, Db, Scope, Ctx, M>
									: never
							: never
						: never
				: never
			: never
		: [Tokens, Acc]

type ParseMulValue<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> =
	ParseUnaryValue<Tokens, Db, Scope, Ctx> extends [infer R0 extends TokensList, infer E0]
		? E0 extends SqlParserError<string>
			? [R0, E0]
			: E0 extends ExprOk<infer T0, infer _S0>
				? T0 extends number
					? E0 extends ExprOk<number, infer Sacc extends string>
						? ParseMulLoopAfterFirst<R0, Db, Scope, Ctx, ExprOk<number, Sacc>>
						: never
					: PeekToken<R0> extends infer P
						? P extends TokenKey<"+"> | TokenKey<"-"> | TokenKey<"*">
							? [R0, SqlIncompatibleArithmetic]
							: [R0, E0]
						: never
				: never
		: never

type ParseAddLoopAfterFirst<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
	Acc extends ExprOk<number, string>,
> =
	PeekToken<Tokens> extends TokenKey<"+">
		? ReadToken<Tokens> extends [infer R1 extends TokensList, TokenKey<"+">]
			? ParseMulValue<R1, Db, Scope, Ctx> extends [infer R2 extends TokensList, infer E1]
				? E1 extends SqlParserError<string>
					? [R2, E1]
					: E1 extends ExprAtom
						? MergeNumericArithmetic<Acc, E1> extends infer M
							? M extends SqlParserError<string>
								? [R2, M]
								: M extends ExprOk<number, "number">
									? ParseAddLoopAfterFirst<R2, Db, Scope, Ctx, M>
									: never
							: never
						: never
				: never
			: never
		: PeekToken<Tokens> extends TokenKey<"-">
			? ReadToken<Tokens> extends [infer R3 extends TokensList, TokenKey<"-">]
				? ParseMulValue<R3, Db, Scope, Ctx> extends [infer R4 extends TokensList, infer E2]
					? E2 extends SqlParserError<string>
						? [R4, E2]
						: E2 extends ExprAtom
							? MergeNumericArithmetic<Acc, E2> extends infer M2
								? M2 extends SqlParserError<string>
									? [R4, M2]
									: M2 extends ExprOk<number, "number">
										? ParseAddLoopAfterFirst<R4, Db, Scope, Ctx, M2>
										: never
								: never
							: never
					: never
				: never
			: [Tokens, Acc]

export type ParseAddValue<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> =
	ParseMulValue<Tokens, Db, Scope, Ctx> extends [infer R0 extends TokensList, infer E0]
		? E0 extends SqlParserError<string>
			? [R0, E0]
			: E0 extends ExprOk<infer T0, infer _S0>
				? T0 extends number
					? E0 extends ExprOk<number, infer Sacc extends string>
						? ParseAddLoopAfterFirst<R0, Db, Scope, Ctx, ExprOk<number, Sacc>>
						: never
					: PeekToken<R0> extends infer P
						? P extends TokenKey<"+"> | TokenKey<"-"> | TokenKey<"*">
							? [R0, SqlIncompatibleArithmetic]
							: [R0, E0]
						: never
				: never
		: never

/** Shared entry: typed expression with `AND` / `OR` / `NOT`, comparisons, `IS NULL`, `IN`, column refs, params. */
export type ParseExpression<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> = ParseOrEntry<Tokens, Db, Scope, Ctx>

export type ParseOrEntry<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> =
	ParseAndTyped<Tokens, Db, Scope, Ctx> extends [infer R0 extends TokensList, infer E0]
		? E0 extends SqlParserError<string>
			? [R0, E0]
			: E0 extends ExprOk<infer T0, infer _S0>
				? T0 extends boolean
					? ParseOrLoopAfterFirst<R0, Db, Scope, Ctx>
					: [R0, SqlExprMustBeBoolean]
				: never
		: never

/** Typed boolean expression (WHERE / future HAVING). */
export type ParseBooleanExpression<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> = ParseOrEntry<Tokens, Db, Scope, Ctx>
