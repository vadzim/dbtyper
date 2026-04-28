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

/** True when `T` is `unknown` or `any` (not other types). */
export type IsUnknownOrAny<T> = 0 extends 1 & T ? true : unknown extends T ? (T extends unknown ? true : false) : false

export type ExprOk<Ts, Sql extends string> = { ok: true; ts: Ts; sql: Sql }

/** SQL `NULL` literal — may only appear in `IS [NOT] NULL`, not in `=` / `<>`. */
export type ExprSqlNull = { ok: true; ts: null; sql: "null"; exprKind: "sql_null" }

export type ExprAtom = ExprOk<unknown, string> | ExprSqlNull

/** Identifier chain in a scalar expression AST (syntax only until {@link ResolveExpressionAST}). */
export type ScalarIdentParts = readonly [string] | readonly [string, string] | readonly [string, string, string]

/** Comparison operator in {@link ScalarExprAst} `cmp` (resolved like PostgreSQL class rules). */
export type ScalarCmpOp = "eq" | "ne" | "lt" | "le" | "gt" | "ge"

/**
 * Expression AST for SELECT-list parsing (arithmetic, boolean `AND`/`OR`/`NOT`, comparisons, `IS [NOT] NULL`, `IN (...)`).
 * Resolve with {@link ResolveExpressionAST} when `FROM` scope is known.
 */
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
	| { kind: "not"; inner: ScalarExprAst }
	| { kind: "and"; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "or"; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "cmp"; op: ScalarCmpOp; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "is_null"; expr: ScalarExprAst }
	| { kind: "is_not_null"; expr: ScalarExprAst }
	| { kind: "in_list"; expr: ScalarExprAst; items: readonly ScalarExprAst[] }
	/** PostgreSQL `expr::typename` (supports multi-word types and `varchar(`…`)` modifiers). */
	| { kind: "pg_cast"; expr: ScalarExprAst; type_parts: readonly string[] }
	/** Standard `CAST(expr AS typename)`. */
	| { kind: "sql_cast"; expr: ScalarExprAst; type_parts: readonly string[] }

/** Lowercase joined SQL type name for cast resolution (e.g. `["double","precision"]` → `"double precision"`). */
export type SqlCastTypeNorm<P extends readonly string[]> = P extends readonly [
	infer H extends string,
	...infer T extends readonly string[],
]
	? T extends readonly []
		? Lowercase<H>
		: `${Lowercase<H>} ${SqlCastTypeNorm<T>}`
	: string

/** `AS` / `::` type list: identifiers, optional `(…)` after a name, until `)` (CAST) or non-type token (`::` chain). */
type ParseSqlTypeName<Tokens extends TokensList, Acc extends readonly string[] = []> =
	PeekToken<Tokens> extends TokenIdent<infer W extends string>
		? ReadToken<Tokens> extends [infer R1 extends TokensList, TokenIdent<W>]
			? PeekToken<R1> extends TokenKey<"(">
				? SkipBracketedUntil<SkipToken<R1>, TokenKey<")">> extends [infer R2 extends TokensList, infer Rs]
					? Rs extends SqlParserError<string>
						? [R2, Rs]
						: ParseSqlTypeName<R2, readonly [...Acc, W]>
					: never
				: PeekToken<R1> extends TokenIdent<string>
					? ParseSqlTypeName<R1, readonly [...Acc, W]>
					: [R1, readonly [...Acc, W]]
			: never
		: PeekToken<Tokens> extends TokenKey<")">
			? Acc extends readonly []
				? [Tokens, SqlParserError<"Expected type name">]
				: [Tokens, Acc]
			: Acc extends readonly []
				? [Tokens, SqlParserError<"Expected type name">]
				: [Tokens, Acc]

type ParseCastKeywordOperand<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"cast">
		? ReadToken<Tokens> extends [infer R0 extends TokensList, TokenKey<"cast">]
			? PeekToken<R0> extends TokenKey<"(">
				? ReadToken<R0> extends [infer R1 extends TokensList, TokenKey<"(">]
					? ParseOrScalarUntyped<R1> extends [infer R2 extends TokensList, infer Inner]
						? Inner extends SqlParserError<string>
							? [R2, Inner]
							: Inner extends ScalarExprAst
								? PeekToken<R2> extends TokenKey<"as">
									? ReadToken<R2> extends [infer R3 extends TokensList, TokenKey<"as">]
										? ParseSqlTypeName<R3, []> extends [infer R4 extends TokensList, infer Parts]
											? Parts extends SqlParserError<string>
												? [R4, Parts]
												: Parts extends readonly []
													? [R4, SqlParserError<"Expected type name after CAST ... AS">]
													: Parts extends readonly string[]
														? ReadToken<R4> extends [infer R5 extends TokensList, infer TokCl]
															? TokCl extends TokenKey<")">
																? [R5, { kind: "sql_cast"; expr: Inner; type_parts: Parts }]
																: [R5, SqlParserError<"Expected `)` after CAST type">]
															: never
														: never
												: never
										: never
									: [R2, SqlParserError<"Expected AS in CAST">]
								: never
						: never
					: never
				: [R0, SqlParserError<"Expected `(` after CAST">]
			: never
		: never

type ParsePgCastSuffixTail<Tokens extends TokensList, Acc extends ScalarExprAst> =
	PeekToken<Tokens> extends TokenKey<"::">
		? ReadToken<Tokens> extends [infer R0 extends TokensList, TokenKey<"::">]
			? ParseSqlTypeName<R0, []> extends [infer R1 extends TokensList, infer Parts]
				? Parts extends SqlParserError<string>
					? [R1, Parts]
					: Parts extends readonly []
						? [R1, SqlParserError<"Expected type name after ::">]
						: Parts extends readonly string[]
							? ParsePgCastSuffixTail<R1, { kind: "pg_cast"; expr: Acc; type_parts: Parts }>
							: never
				: never
			: never
		: [Tokens, Acc]

/** Additive / multiplicative / unary-minus / primary (no `AND`/`OR`/`NOT`/comparisons at this level). */
type ParseAddScalarUntyped<Tokens extends TokensList> = PeekToken<Tokens> extends TokenIdent<string>
	? ParseScalarExprUntypedFromIdent<Tokens>
	: ParseScalarExprUntypedNonIdent<Tokens>

type TokenToCmpOp<Tok> = Tok extends TokenKey<"=">
	? "eq"
	: Tok extends TokenKey<"<>"> | TokenKey<"!=">
		? "ne"
		: Tok extends TokenKey<"<">
			? "lt"
			: Tok extends TokenKey<"<=">
				? "le"
				: Tok extends TokenKey<">">
					? "gt"
					: Tok extends TokenKey<">=">
						? "ge"
						: never

/** Comma-separated scalar expressions inside `IN (` … `)` (untyped AST for resolve). */
type ParseInListUntypedAccum<
	Tokens extends TokensList,
	Acc extends readonly ScalarExprAst[],
> = ParseOrScalarUntyped<Tokens> extends [infer R1 extends TokensList, infer E]
	? E extends SqlParserError<string>
		? [R1, E]
		: E extends ScalarExprAst
			? PeekToken<R1> extends TokenKey<")">
				? ReadToken<R1> extends [infer R2 extends TokensList, TokenKey<")">]
					? [R2, readonly [...Acc, E]]
					: never
				: PeekToken<R1> extends TokenKey<",">
					? ReadToken<R1> extends [infer R3 extends TokensList, TokenKey<",">]
						? ParseInListUntypedAccum<R3, readonly [...Acc, E]>
						: never
					: [R1, SqlParserError<"Expected `,` or `)` in IN list">]
			: never
	: never

type ParseInListUntypedTail<Tokens extends TokensList> = PeekToken<Tokens> extends TokenKey<")">
	? [Tokens, SqlParserError<"IN list must not be empty">]
	: ParseInListUntypedAccum<Tokens, readonly []>

type ParseAfterIsUntyped<Tokens extends TokensList, L extends ScalarExprAst> =
	PeekToken<Tokens> extends TokenKey<"not">
		? ReadToken<Tokens> extends [infer R5 extends TokensList, TokenKey<"not">]
			? PeekToken<R5> extends TokenKey<"null">
				? ReadToken<R5> extends [infer R6 extends TokensList, TokenKey<"null">]
					? [R6, { kind: "is_not_null"; expr: L }]
					: ReadToken<R5> extends [infer R5b extends TokensList, infer _TokN]
						? [R5b, SqlParserError<"Expected NULL after IS NOT">]
						: never
				: [R5, SqlParserError<"Expected NULL after IS NOT">]
			: never
		: PeekToken<Tokens> extends TokenKey<"null">
			? ReadToken<Tokens> extends [infer R7 extends TokensList, TokenKey<"null">]
				? [R7, { kind: "is_null"; expr: L }]
				: never
			: [Tokens, SqlParserError<"Expected NULL after IS">]

type ParseAfterAddScalarRelIsInUntyped<Tokens extends TokensList, L extends ScalarExprAst> =
	PeekToken<Tokens> extends infer P
		? IsRelOp<P> extends true
			? ReadToken<Tokens> extends [infer R2 extends TokensList, infer OpTok]
				? ParseAddScalarUntyped<R2> extends [infer R3 extends TokensList, infer Rhs]
					? Rhs extends SqlParserError<string>
						? [R3, Rhs]
						: TokenToCmpOp<OpTok> extends infer Cop extends ScalarCmpOp
							? [R3, { kind: "cmp"; op: Cop; left: L; right: Rhs }]
							: [R3, SqlParserError<"Invalid comparison operator">]
					: never
				: never
			: P extends TokenKey<"is">
				? ReadToken<Tokens> extends [infer R4 extends TokensList, TokenKey<"is">]
					? ParseAfterIsUntyped<R4, L>
					: never
				: P extends TokenKey<"in">
					? ReadToken<Tokens> extends [infer R8 extends TokensList, TokenKey<"in">]
						? PeekToken<R8> extends TokenKey<"(">
							? ParseInListUntypedTail<SkipToken<R8>> extends [infer R9 extends TokensList, infer ListRes]
								? ListRes extends SqlParserError<string>
									? [R9, ListRes]
									: ListRes extends readonly ScalarExprAst[]
										? [R9, { kind: "in_list"; expr: L; items: ListRes }]
										: never
								: never
							: [R8, SqlParserError<"Expected `(` after IN">]
						: never
					: [Tokens, L]
		: never

type ParseRelScalarUntyped<Tokens extends TokensList> =
	ParseAddScalarUntyped<Tokens> extends [infer R1 extends TokensList, infer E1]
		? E1 extends SqlParserError<string>
			? [R1, E1]
			: E1 extends ScalarExprAst
				? ParseAfterAddScalarRelIsInUntyped<R1, E1>
				: never
		: never

type ParseNotScalarUntyped<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"not">
		? ReadToken<Tokens> extends [infer Rn extends TokensList, TokenKey<"not">]
			? ParseNotScalarUntyped<Rn> extends [infer Ru extends TokensList, infer U]
				? U extends SqlParserError<string>
					? [Ru, U]
					: U extends ScalarExprAst
						? [Ru, { kind: "not"; inner: U }]
						: never
				: never
			: never
		: ParseRelScalarUntyped<Tokens>

type ParseAndLoopScalarUntyped<Tokens extends TokensList, Acc extends ScalarExprAst> =
	PeekToken<Tokens> extends TokenKey<"and">
		? ReadToken<Tokens> extends [infer R1 extends TokensList, TokenKey<"and">]
			? ParseNotScalarUntyped<R1> extends [infer R2 extends TokensList, infer E1]
				? E1 extends SqlParserError<string>
					? [R2, E1]
					: E1 extends ScalarExprAst
						? ParseAndLoopScalarUntyped<R2, { kind: "and"; left: Acc; right: E1 }>
						: never
				: never
			: never
		: [Tokens, Acc]

type ParseAndScalarUntyped<Tokens extends TokensList> =
	ParseNotScalarUntyped<Tokens> extends [infer R0 extends TokensList, infer E0]
		? E0 extends SqlParserError<string>
			? [R0, E0]
			: E0 extends ScalarExprAst
				? ParseAndLoopScalarUntyped<R0, E0>
				: never
		: never

type ParseOrLoopScalarUntyped<Tokens extends TokensList, Acc extends ScalarExprAst> =
	PeekToken<Tokens> extends TokenKey<"or">
		? ReadToken<Tokens> extends [infer R1 extends TokensList, TokenKey<"or">]
			? ParseAndScalarUntyped<R1> extends [infer R2 extends TokensList, infer E1]
				? E1 extends SqlParserError<string>
					? [R2, E1]
					: E1 extends ScalarExprAst
						? ParseOrLoopScalarUntyped<R2, { kind: "or"; left: Acc; right: E1 }>
						: never
				: never
			: never
		: [Tokens, Acc]

type ParseOrScalarUntyped<Tokens extends TokensList> =
	ParseAndScalarUntyped<Tokens> extends [infer R0 extends TokensList, infer E0]
		? E0 extends SqlParserError<string>
			? [R0, E0]
			: E0 extends ScalarExprAst
				? ParseOrLoopScalarUntyped<R0, E0>
				: never
		: never

/** Parse expression to AST to be resolved later when `FROM` scope is known (`OR` … `AND` … `NOT` … comparisons … arithmetic). */
export type ParseExpressionAST<Tokens extends TokensList> = ParseOrScalarUntyped<Tokens>

/** Resolve after `FROM` scope is known */
export type ResolveExpressionAST<
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
											: Ast extends { kind: "not"; inner: infer I extends ScalarExprAst }
												? ResolveExpressionAST<I, Db, Scope, Ctx> extends infer V
													? MergeBoolNot<V>
													: never
												: Ast extends { kind: "and"; left: infer La extends ScalarExprAst; right: infer Ra extends ScalarExprAst }
													? ResolveExpressionAST<La, Db, Scope, Ctx> extends infer Lv
														? ResolveExpressionAST<Ra, Db, Scope, Ctx> extends infer Rv
															? MergeBoolBinary<Lv, Rv, "AND operands must be boolean">
															: never
														: never
													: Ast extends { kind: "or"; left: infer Lo extends ScalarExprAst; right: infer Ro extends ScalarExprAst }
														? ResolveExpressionAST<Lo, Db, Scope, Ctx> extends infer Lv2
															? ResolveExpressionAST<Ro, Db, Scope, Ctx> extends infer Rv2
																? MergeBoolBinary<Lv2, Rv2, "OR operands must be boolean">
																: never
															: never
														: Ast extends {
																	kind: "cmp"
																	op: infer _Op extends ScalarCmpOp
																	left: infer Lc extends ScalarExprAst
																	right: infer Rc extends ScalarExprAst
															  }
															? ResolveExpressionAST<Lc, Db, Scope, Ctx> extends infer LcV
																? ResolveExpressionAST<Rc, Db, Scope, Ctx> extends infer RcV
																	? LcV extends SqlParserError<string>
																		? LcV
																		: RcV extends SqlParserError<string>
																			? RcV
																			: LcV extends ExprAtom
																				? RcV extends ExprAtom
																					? MergeComparison<LcV, RcV>
																					: SqlParserError<"Invalid comparison operand">
																				: SqlParserError<"Invalid comparison operand">
																	: never
																: never
															: Ast extends { kind: "is_null"; expr: infer E0 extends ScalarExprAst }
																? ResolveExpressionAST<E0, Db, Scope, Ctx> extends infer V0
																	? V0 extends SqlParserError<string>
																		? V0
																		: V0 extends ExprSqlNull
																			? ExprOk<true, "boolean">
																			: V0 extends ExprOk<unknown, string>
																				? ExprOk<false, "boolean">
																				: SqlParserError<"Invalid IS NULL operand">
																	: never
																	: Ast extends { kind: "is_not_null"; expr: infer E1 extends ScalarExprAst }
																	? ResolveExpressionAST<E1, Db, Scope, Ctx> extends infer V1
																		? V1 extends SqlParserError<string>
																			? V1
																			: V1 extends ExprSqlNull
																				? ExprOk<false, "boolean">
																				: V1 extends ExprOk<unknown, string>
																					? ExprOk<true, "boolean">
																					: SqlParserError<"Invalid IS NOT NULL operand">
																		: never
																	: Ast extends {
																				kind: "pg_cast"
																				expr: infer Exc extends ScalarExprAst
																				type_parts: infer Ptc extends readonly string[]
																		  }
																		? ResolveExpressionAST<Exc, Db, Scope, Ctx> extends infer Evc
																			? Evc extends SqlParserError<string>
																				? Evc
																				: Evc extends ExprAtom
																					? SqlCastTypeNorm<Ptc> extends infer Normc extends string
																						? ResolveCastFromAtom<Evc, Normc>
																						: SqlParserError<"Invalid cast target">
																					: SqlParserError<"Invalid cast operand">
																			: never
																		: Ast extends {
																					kind: "sql_cast"
																					expr: infer Exs extends ScalarExprAst
																					type_parts: infer Pts extends readonly string[]
																			  }
																			? ResolveExpressionAST<Exs, Db, Scope, Ctx> extends infer Evs
																				? Evs extends SqlParserError<string>
																					? Evs
																					: Evs extends ExprAtom
																						? SqlCastTypeNorm<Pts> extends infer Norms extends string
																							? ResolveCastFromAtom<Evs, Norms>
																							: SqlParserError<"Invalid cast target">
																						: SqlParserError<"Invalid cast operand">
																				: never
																			: Ast extends {
																					kind: "in_list"
																					expr: infer Eln extends ScalarExprAst
																					items: infer Ins extends readonly ScalarExprAst[]
																			  }
																				? ResolveExpressionAST<Eln, Db, Scope, Ctx> extends infer LvIn
																					? LvIn extends SqlParserError<string>
																						? LvIn
																						: LvIn extends ExprAtom
																							? ResolveInListItemsAgainstLeft<LvIn, Ins, Db, Scope, Ctx>
																							: SqlParserError<"Invalid IN left operand">
																						: never
																				: SqlParserError<"Invalid scalar expression">

/** typed expression with `AND` / `OR` / `NOT`, comparisons, `IS NULL`, `IN`, column refs, params. */
export type ParseBooleanExpression<
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
					: [R0, SqlParserError<"Expression must be boolean">]
				: never
		: never

/** Longest `a` / `a.b` / `a.b.c` chain starting at an identifier (used by SELECT list fast path). */
type MaximalIdentChain<Tokens extends TokensList> =
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
					? [After, SqlParserError<"Unbalanced parentheses">]
					: [After, SqlParserError<"Unsupported parenthesized expression">]
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

/** Per-element check for `expr IN (…)` (same class rules as `=`, but `NULL` list elements are rejected). */
type ValidateInListElement<L extends ExprAtom, R extends ExprAtom> = L extends ExprSqlNull
	? SqlParserError<"Invalid IN left operand">
	: R extends ExprSqlNull
		? SqlParserError<"Incompatible types in IN list">
		: L extends ExprOk<infer TsL, infer _Sl>
			? R extends ExprOk<infer TsR, infer _Sr>
				? SameComparisonClass<TsL, TsR> extends true
					? true
					: SqlParserError<"Incompatible types in IN list">
				: SqlParserError<"Invalid IN list element">
			: SqlParserError<"Invalid IN list element">

type ResolveInListItemsAgainstLeft<
	Left extends ExprAtom,
	Items extends readonly ScalarExprAst[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> = Items extends readonly [infer H extends ScalarExprAst, ...infer Tail extends readonly ScalarExprAst[]]
	? ResolveExpressionAST<H, Db, Scope, Ctx> extends infer Hv
		? Hv extends SqlParserError<string>
			? Hv
			: Hv extends ExprAtom
				? ValidateInListElement<Left, Hv> extends infer V
					? V extends SqlParserError<string>
						? V
						: V extends true
							? Tail extends readonly []
								? ExprOk<boolean, "boolean">
								: ResolveInListItemsAgainstLeft<Left, Tail, Db, Scope, Ctx>
							: never
					: never
				: SqlParserError<"Invalid IN list element">
			: never
	: SqlParserError<"IN list must not be empty">

type MergeBoolNot<V> = V extends SqlParserError<string>
	? V
	: V extends ExprSqlNull
		? SqlParserError<"NOT argument must be boolean, not NULL">
		: V extends ExprOk<infer T, infer _S>
			? T extends boolean
				? ExprOk<boolean, "boolean">
				: SqlParserError<"NOT requires a boolean operand">
			: SqlParserError<"NOT requires a boolean operand">

type MergeBoolBinary<L, R, Msg extends string> = L extends SqlParserError<string>
	? L
	: R extends SqlParserError<string>
		? R
		: L extends ExprSqlNull
			? SqlParserError<"NULL is not a valid boolean operand (use IS NULL)">
			: R extends ExprSqlNull
				? SqlParserError<"NULL is not a valid boolean operand (use IS NULL)">
				: L extends ExprOk<infer Tl, infer _Sl>
					? R extends ExprOk<infer Tr, infer _Sr>
						? Tl extends boolean
							? Tr extends boolean
								? ExprOk<boolean, "boolean">
								: SqlParserError<Msg>
							: SqlParserError<Msg>
						: SqlParserError<Msg>
					: SqlParserError<Msg>

/** `CAST` / `::` result typing (PostgreSQL-oriented compatibility checks). */
type ResolveCastFromAtom<Ev extends ExprAtom, N extends string> = Ev extends ExprSqlNull
	? ExprSqlNull
	: Ev extends ExprOk<infer Ts, infer _SFrom>
		? N extends "text" | "varchar" | "character varying" | "char"
			? Ts extends string | number | boolean
				? ExprOk<string, "text">
				: SqlParserError<"Invalid cast to text">
			: N extends "integer" | "int" | "int4" | "smallint" | "int2"
				? Ts extends number
					? ExprOk<number, "integer">
					: SqlParserError<"Invalid cast to integer">
				: N extends "bigint" | "int8"
					? Ts extends number
						? ExprOk<number, "bigint">
						: SqlParserError<"Invalid cast to bigint">
					: N extends "boolean" | "bool"
						? Ts extends boolean
							? ExprOk<boolean, "boolean">
							: SqlParserError<"Invalid cast to boolean">
						: N extends "uuid"
							? Ts extends string
								? ExprOk<string, "uuid">
								: SqlParserError<"Invalid cast to uuid">
							: N extends "real" | "float4" | "double precision" | "float8" | "numeric" | "decimal"
								? Ts extends number
									? ExprOk<number, "number">
									: SqlParserError<"Invalid cast to floating-point or numeric type">
								: SqlParserError<"Unsupported cast target type">
		: SqlParserError<"Invalid cast operand">

type TryOperandTyped<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> =
	PeekToken<Tokens> extends TokenKey<"(">
		? SkipBracketedUntil<SkipToken<Tokens>, TokenKey<")">> extends [infer AfterSp extends TokensList, infer Rs]
			? Rs extends SqlParserError<string>
				? [AfterSp, SqlParserError<"Unbalanced parentheses">]
				: [AfterSp, SqlParserError<"Unsupported parenthesized expression">]
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
			: ParseAfterOperandNoRel<Tokens, Lhs, P, Db, Scope, Ctx>
		: never

type ParseInListTypedAccum<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
	Left extends ExprAtom,
> = ParseAddValue<Tokens, Db, Scope, Ctx> extends [infer R1 extends TokensList, infer Ev]
	? Ev extends SqlParserError<string>
		? [R1, Ev]
		: Ev extends ExprAtom
			? ValidateInListElement<Left, Ev> extends infer Vl
				? Vl extends SqlParserError<string>
					? [R1, Vl]
					: Vl extends true
						? PeekToken<R1> extends TokenKey<")">
							? ReadToken<R1> extends [infer R2 extends TokensList, TokenKey<")">]
								? [R2, ExprOk<boolean, "boolean">]
								: never
							: PeekToken<R1> extends TokenKey<",">
								? ReadToken<R1> extends [infer R3 extends TokensList, TokenKey<",">]
									? ParseInListTypedAccum<R3, Db, Scope, Ctx, Left>
									: never
								: [R1, SqlParserError<"Expected `,` or `)` in IN list">]
						: never
				: never
			: never
	: never

type ParseInListTypedTail<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
	Left extends ExprAtom,
> = PeekToken<Tokens> extends TokenKey<")">
	? [Tokens, SqlParserError<"IN list must not be empty">]
	: ParseInListTypedAccum<Tokens, Db, Scope, Ctx, Left>

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

type ParseAfterOperandNoRel<
	Tokens extends TokensList,
	Lhs extends ExprAtom,
	P,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> =
	P extends TokenKey<"is">
		? ReadToken<Tokens> extends [infer R4 extends TokensList, TokenKey<"is">]
			? ParseAfterIs<R4>
			: never
		: P extends TokenKey<"in">
			? ReadToken<Tokens> extends [infer R8 extends TokensList, TokenKey<"in">]
				? PeekToken<R8> extends TokenKey<"(">
					? ReadToken<R8> extends [infer Rlp extends TokensList, TokenKey<"(">]
						? ParseInListTypedTail<Rlp, Db, Scope, Ctx, Lhs> extends [infer R9 extends TokensList, infer OutIn]
							? OutIn extends SqlParserError<string>
								? [R9, OutIn]
								: OutIn extends ExprOk<boolean, "boolean">
									? [R9, OutIn]
									: never
							: never
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
			? ParseBooleanExpression<Ri, Db, Scope, Ctx> extends [infer Rj extends TokensList, infer Ej]
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
							: [Ru, SqlParserError<"Expression must be boolean">]
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
							: [R2, SqlParserError<"Expression must be boolean">]
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
					: [R0, SqlParserError<"Expression must be boolean">]
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
							: [R2, SqlParserError<"Expression must be boolean">]
						: never
				: never
			: never
		: [Tokens, ExprOk<boolean, "boolean">]

type MergeNumericArithmetic<L extends ExprAtom, R extends ExprAtom> = L extends ExprSqlNull
	? SqlParserError<"NULL not allowed in arithmetic">
	: R extends ExprSqlNull
		? SqlParserError<"NULL not allowed in arithmetic">
		: L extends ExprOk<infer TsL, infer _Sl>
			? R extends ExprOk<infer TsR, infer _Sr>
				? TsL extends number
					? TsR extends number
						? ExprOk<number, "number">
						: SqlParserError<"Incompatible types in arithmetic">
					: SqlParserError<"Incompatible types in arithmetic">
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
					: E extends { kind: "pg_cast"; expr: infer Ic extends ScalarExprAst; type_parts: infer Pc extends readonly string[] }
						? SqlCastTypeNorm<Pc> extends infer Nc extends string
							? Nc extends "text" | "varchar" | "character varying" | "char"
								? true
								: ScalarAstNonNumericForMulHead<Ic>
							: ScalarAstNonNumericForMulHead<Ic>
						: E extends { kind: "sql_cast"; expr: infer Ics extends ScalarExprAst; type_parts: infer Pcs extends readonly string[] }
							? SqlCastTypeNorm<Pcs> extends infer Ncs extends string
								? Ncs extends "text" | "varchar" | "character varying" | "char"
									? true
									: ScalarAstNonNumericForMulHead<Ics>
								: ScalarAstNonNumericForMulHead<Ics>
							: false

type TryOperandScalarUntyped<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"cast">
		? ParseCastKeywordOperand<Tokens>
		: PeekToken<Tokens> extends TokenKey<"(">
			? ReadToken<Tokens> extends [infer Ri extends TokensList, TokenKey<"(">]
				? ParseExpressionAST<Ri> extends [infer Rj extends TokensList, infer Ej]
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
		: TryOperandScalarUntyped<Tokens> extends [infer Tu extends TokensList, infer Bu]
			? Bu extends SqlParserError<string>
				? [Tu, Bu]
				: Bu extends ScalarExprAst
					? ParsePgCastSuffixTail<Tu, Bu>
					: never
			: never

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
							? [R0, SqlParserError<"Incompatible types in arithmetic">]
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
					? [After, SqlParserError<"Unbalanced parentheses">]
					: [After, SqlParserError<"Unsupported parenthesized expression">]
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
							? [R0, SqlParserError<"Incompatible types in arithmetic">]
							: [R0, E0]
						: never
					: ParseAddLoopAfterFirstScalarUntyped<R0, E0>
				: never
		: never

type ResolveScalarExprAstPair<
	L extends ScalarExprAst,
	R extends ScalarExprAst,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Ctx extends ExpressionParseContext,
> =
	ResolveExpressionAST<L, Db, Scope, Ctx> extends infer Lv
		? Lv extends SqlParserError<string>
			? Lv
			: ResolveExpressionAST<R, Db, Scope, Ctx> extends infer Rv
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
	ResolveExpressionAST<I, Db, Scope, Ctx> extends infer U
		? U extends SqlParserError<string>
			? U
			: U extends ExprOk<number, infer _Sn>
				? ExprOk<number, "number">
				: SqlParserError<"Unary minus requires a number">
		: never

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
							: [Ru, SqlParserError<"Unary minus requires a number">]
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
							? [R0, SqlParserError<"Incompatible types in arithmetic">]
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

type ParseAddValue<
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
							? [R0, SqlParserError<"Incompatible types in arithmetic">]
							: [R0, E0]
						: never
				: never
		: never
