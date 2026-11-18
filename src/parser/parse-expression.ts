import type { DbDialectOnlyError, DialectFact } from "../core/dialect.ts"
import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { Dec, ParseNumber } from "../core/type-utils.ts"
import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { ParserMonad, PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type {
	AsIdent,
	TokenIdent,
	TokenIndexedParam,
	TokenKey,
	TokenNumber,
	TokenParam,
	TokenString,
	TokenType,
} from "../lexer/sql-lexer.ts"
import type { EnumComparisonCheck } from "./parse-enum-checks.ts"
import type { ParseCallArgs, ParseOptionalOverClause } from "./parse-function-call.ts"
import type { ParseParenEnclosedSelect, ParseParenScalarSelect } from "./parse-select-subquery.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { CastPgOnlyTypeError, CastTypeParts, SqlCastTypeNorm } from "./resolve-cast.ts"
import type { MaximalIdentChain } from "./resolve-expression.ts"
import type { SkipBracketedUntil, SkipFailedExpression, SkipFailedExpressionWithEnv } from "./skip-statement.ts"

/** Caller-supplied `:name` bindings (names must match lexer param identifiers). */
export type ExpressionParamsShape = Record<string, SqlTypeShape> | readonly SqlTypeShape[]

/** Default `Params` for parsers: `keyof` is `never` (plain `{}` widens against `Record<string, …>`). */
export type EmptyExpressionParams = Record<never, never>

/** Threaded through scalar parse for subqueries: catalog, `:param` bindings, outer aliases visible inside `(SELECT …)`. */
export type ExprParseEnv = {
	db: JsqlDatabaseShape
	params: ExpressionParamsShape
	outerScope: ScopeMap
	/** Set while parsing an unparenthesized column DEFAULT: a following `NOT` is `NOT NULL`, not `NOT LIKE`. */
	noPostfixNot?: true
}

/** Identifier chain in a scalar expression AST (syntax only until {@link ResolveExpressionAST}). */
export type ScalarIdentParts = readonly [string] | readonly [string, string] | readonly [string, string, string]

/** Comparison operator in {@link ScalarExprAst} `cmp` (resolved like PostgreSQL class rules). */
export type ScalarCmpOp = "eq" | "ne" | "lt" | "le" | "gt" | "ge"

/**
 * Expression AST for SELECT-list parsing (arithmetic, boolean `AND`/`OR`/`NOT`, comparisons, `IS [NOT] NULL`, `IN (...)`, simple and searched `CASE`, etc.).
 * Resolve with {@link ResolveExpressionAST} when `FROM` scope is known.
 */
export type ScalarExprAst =
	| { kind: "true" }
	| { kind: "false" }
	| { kind: "sql_null" }
	| { kind: "string"; value: string }
	| { kind: "number"; raw: string }
	| { kind: "param"; name: string }
	| { kind: "positional-param"; index: number }
	| { kind: "col"; parts: ScalarIdentParts; written?: string }
	/** `alias.*` in a SELECT list item (resolved against JOIN scope). */
	| { kind: "alias_table_star"; alias: string }
	/** `schema.table.*` in a SELECT list item (resolved against catalog + JOIN scope). */
	| { kind: "qualified_table_star"; schema: string; table: string }
	| { kind: "neg"; inner: ScalarExprAst }
	| { kind: "add"; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "sub"; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "mul"; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "not"; inner: ScalarExprAst }
	| { kind: "and"; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "or"; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "cmp"; op: ScalarCmpOp; left: ScalarExprAst; right: ScalarExprAst }
	/** SQLite `a IS [NOT] [DISTINCT FROM] b`: null-safe comparison (SQLT-33). */
	| { kind: "is_cmp"; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "is_null"; expr: ScalarExprAst }
	| { kind: "is_not_null"; expr: ScalarExprAst }
	| { kind: "in_list"; expr: ScalarExprAst; items: readonly ScalarExprAst[] }
	| { kind: "in_subquery"; expr: ScalarExprAst; sub: JsqlSelectStatementResult }
	| { kind: "scalar_subquery"; sel: JsqlSelectStatementResult }
	| { kind: "exists_subquery"; sub: JsqlSelectStatementResult }
	/** PostgreSQL `= ANY(array_expr)` or `= ANY(subquery)` */
	| { kind: "any_op"; op: string; left: ScalarExprAst; right: ScalarExprAst | JsqlSelectStatementResult }
	/** PostgreSQL `= ALL(array_expr)` or `= ALL(subquery)` */
	| { kind: "all_op"; op: string; left: ScalarExprAst; right: ScalarExprAst | JsqlSelectStatementResult }
	/** PostgreSQL `= SOME(array_expr)` or `= SOME(subquery)` (alias for ANY) */
	| { kind: "some_op"; op: string; left: ScalarExprAst; right: ScalarExprAst | JsqlSelectStatementResult }
	/** PostgreSQL `ARRAY[` … `]` constructor (comma-separated scalar expressions). */
	| { kind: "array_ctor"; elements: readonly ScalarExprAst[] }
	/** One-based or zero-based semantics are dialect-specific at runtime; MVP element access typing. */
	| { kind: "array_index"; base: ScalarExprAst; index: ScalarExprAst }
	/** PostgreSQL `expr::typename` (supports multi-word types and `varchar(`…`)` modifiers). */
	| { kind: "pg_cast"; expr: ScalarExprAst; type_parts: readonly string[] }
	/** Standard `CAST(expr AS typename)`. */
	| { kind: "sql_cast"; expr: ScalarExprAst; type_parts: readonly string[] }
	| { kind: "between"; expr: ScalarExprAst; low: ScalarExprAst; high: ScalarExprAst }
	| { kind: "like"; expr: ScalarExprAst; pattern: ScalarExprAst; case_insensitive: boolean }
	/** PostgreSQL `~` / `~*` (regex match; `case_insensitive` from `~*`). */
	| { kind: "pg_regex_match"; expr: ScalarExprAst; pattern: ScalarExprAst; case_insensitive: boolean }
	/** `CASE WHEN … THEN … [WHEN … THEN …]* [ELSE …] END` (searched form). */
	| {
			kind: "case_searched"
			arms: readonly { when: ScalarExprAst; then: ScalarExprAst }[]
			else_: ScalarExprAst | null
	  }
	/** `CASE expr WHEN … THEN … [WHEN … THEN …]* [ELSE …] END` (simple form; `WHEN` values compare to `expr` like `=`). */
	| {
			kind: "case_simple"
			discriminant: ScalarExprAst
			arms: readonly { when: ScalarExprAst; then: ScalarExprAst }[]
			else_: ScalarExprAst | null
	  }
	| { kind: "custom_op"; op: string; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "exp"; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "mod"; left: ScalarExprAst; right: ScalarExprAst }
	| {
			kind: "function_call"
			name: string
			args: readonly (ScalarExprAst | { kind: "star" })[]
	  }
	| {
			kind: "window_function"
			name: string
			args: readonly (ScalarExprAst | { kind: "star" })[]
			over: {
				partition_by?: readonly ScalarExprAst[]
				order_by: readonly { expr: ScalarExprAst; direction: "asc" | "desc" | null }[]
			}
	  }

/** Lowercase joined SQL type name for cast resolution (e.g. `["double","precision"]` → `"double precision"`). */
/** PGT-14: both bounds of `BETWEEN` against an enum operand. */
export type EnumBetweenCheck<
	Db,
	E extends SqlTypeShape,
	EAst,
	Lo extends SqlTypeShape,
	LoAst,
	Hi extends SqlTypeShape,
	HiAst,
> =
	EnumComparisonCheck<Db, E, EAst, Lo, LoAst> extends infer C1
		? C1 extends true
			? EnumComparisonCheck<Db, E, EAst, Hi, HiAst>
			: C1
		: never

/** `AS` / `::` type list: identifiers, optional `(…)` after a name, until `)` (CAST) or non-type token (`::` chain). */
type ParseSqlTypeName<Tokens extends ParserMonad, Acc extends readonly string[] = []> =
	PeekToken<Tokens> extends TokenIdent<infer W extends string>
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"(">
				? SkipBracketedUntil<SkipToken<R1>, TokenKey<")">> extends [infer R2 extends ParserMonad, infer Rs]
					? Rs extends DbtyperErrorShape
						? SkipFailedExpression<R2, Rs>
						: ParseSqlTypeName<SkipToken<R2>, readonly [...Acc, W]>
					: never
				: PeekToken<R1> extends TokenKey<".">
					? ParseSqlTypeName<SkipToken<R1>, readonly [...Acc, `${W}.`]>
					: PeekToken<R1> extends TokenIdent<string>
						? ParseSqlTypeName<R1, readonly [...Acc, W]>
						: [R1, readonly [...Acc, W]]
			: never
		: PeekToken<Tokens> extends TokenKey<")">
			? Acc extends readonly []
				? SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_TYPE_NAME"], [""]>>
				: [Tokens, Acc]
			: Acc extends readonly []
				? SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_TYPE_NAME"], [""]>>
				: [Tokens, Acc]

/** True when `C` has exactly one own key (one projected column). */
export type SingleProjectionColumn<C extends Record<string, unknown>> = keyof C extends infer A
	? A extends keyof C
		? { [B in keyof C]: B extends A ? 1 : 0 }[keyof C] extends 1
			? true
			: false
		: false
	: false

type ParseCastKeywordOperand<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"cast">
		? SkipToken<Tokens> extends infer R0 extends ParserMonad
			? PeekToken<R0> extends TokenKey<"(">
				? SkipToken<R0> extends infer R1 extends ParserMonad
					? ParseOrScalarUntyped<R1, Env> extends [
							infer R2 extends ParserMonad,
							infer Inner,
							infer Env2 extends ExprParseEnv,
						]
						? Inner extends DbtyperErrorShape
							? SkipFailedExpressionWithEnv<R2, Inner, Env2>
							: Inner extends ScalarExprAst
								? PeekToken<R2> extends TokenKey<"as">
									? SkipToken<R2> extends infer R3 extends ParserMonad
										? ParseSqlTypeName<R3, []> extends [infer R4 extends ParserMonad, infer Parts]
											? Parts extends DbtyperErrorShape
												? SkipFailedExpressionWithEnv<R4, Parts, Env2>
												: Parts extends readonly []
													? SkipFailedExpressionWithEnv<
															R4,
															FormatError<
																Errors["EXPECTED_TYPE_NAME"],
																["after CAST ... AS"]
															>,
															Env2
														>
													: Parts extends readonly string[]
														? PeekToken<R4> extends infer TokCl
															? SkipToken<R4> extends infer R5 extends ParserMonad
																? TokCl extends TokenKey<")">
																	? CastPgOnlyTypeError<
																			Env2["db"],
																			Parts
																		> extends infer TypeErr extends
																			DbtyperErrorShape
																		? [R5, TypeErr, Env2]
																		: [
																				R5,
																				{
																					kind: "sql_cast"
																					expr: Inner
																					type_parts: CastTypeParts<
																						Env2["db"],
																						Parts
																					>
																				},
																				Env2,
																			]
																	: [
																			R5,
																			FormatError<
																				Errors["EXPECTED_CLOSE_PAREN_AFTER_CAST_TYPE"],
																				[]
																			>,
																			Env2,
																		]
																: never
															: never
														: never
											: never
										: never
									: SkipFailedExpressionWithEnv<
											R2,
											FormatError<Errors["EXPECTED_AS_IN_CAST"], []>,
											Env2
										>
								: never
						: never
					: never
				: SkipFailedExpressionWithEnv<R0, FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_CAST"], []>, Env>
			: never
		: never

type ParsePgCastSuffixTail<Tokens extends ParserMonad, Acc extends ScalarExprAst> =
	PeekToken<Tokens> extends TokenKey<"::">
		? SkipToken<Tokens> extends infer R0 extends ParserMonad
			? ParseSqlTypeName<R0, []> extends [infer R1 extends ParserMonad, infer Parts]
				? Parts extends DbtyperErrorShape
					? SkipFailedExpression<R1, Parts>
					: Parts extends readonly []
						? SkipFailedExpression<R1, FormatError<Errors["EXPECTED_TYPE_NAME"], ["after ::"]>>
						: Parts extends readonly string[]
							? ParsePgCastSuffixTail<R1, { kind: "pg_cast"; expr: Acc; type_parts: Parts }>
							: never
				: never
			: never
		: [Tokens, Acc]

/** Additive / multiplicative / unary-minus / primary (no `AND`/`OR`/`NOT`/comparisons at this level). */
type ParseAddScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<string>
		? ParseScalarExprUntypedFromIdent<Tokens, Env>
		: ParseScalarExprUntypedNonIdent<Tokens, Env>

type TokenToCmpOp<Tok> =
	Tok extends TokenKey<"=">
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
	Tokens extends ParserMonad,
	Acc extends readonly ScalarExprAst[],
	Env extends ExprParseEnv,
> =
	ParseOrScalarUntyped<Tokens, Env> extends [infer R1 extends ParserMonad, infer E, infer Env1 extends ExprParseEnv]
		? E extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R1, E, Env1>
			: E extends ScalarExprAst
				? PeekToken<R1> extends TokenKey<")">
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? [R2, readonly [...Acc, E], Env1]
						: never
					: PeekToken<R1> extends TokenKey<",">
						? ParseInListUntypedAccum<SkipToken<R1>, readonly [...Acc, E], Env1>
						: SkipFailedExpressionWithEnv<
								R1,
								FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_IN_IN_LIST"], []>,
								Env1
							>
				: never
		: never

type ParseInListUntypedTail<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<")">
		? SkipFailedExpressionWithEnv<Tokens, FormatError<Errors["IN_LIST_MUST_NOT_BE_EMPTY"], []>, Env>
		: PeekToken<Tokens> extends TokenKey<"select">
			? ParseParenEnclosedSelect<Tokens, Env["db"], Env["params"], Env["outerScope"]> extends [
					infer R9 extends ParserMonad,
					infer Sub,
				]
				? Sub extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R9, Sub, Env>
					: Sub extends JsqlSelectStatementResult
						? [R9, Sub, Env]
						: never
				: never
			: ParseInListUntypedAccum<Tokens, readonly [], Env>

type ParseInListUntypedAfterInKw<Tokens extends ParserMonad, L extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"in">
		? SkipToken<Tokens> extends infer R8 extends ParserMonad
			? PeekToken<R8> extends TokenKey<"(">
				? ParseInListUntypedTail<SkipToken<R8>, Env> extends [
						infer R9 extends ParserMonad,
						infer ListRes,
						infer Env9 extends ExprParseEnv,
					]
					? ListRes extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<R9, ListRes, Env9>
						: ListRes extends JsqlSelectStatementResult
							? [R9, { kind: "in_subquery"; expr: L; sub: ListRes }, Env9]
							: ListRes extends readonly ScalarExprAst[]
								? [R9, { kind: "in_list"; expr: L; items: ListRes }, Env9]
								: never
					: never
				: SkipFailedExpressionWithEnv<R8, FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_IN"], []>, Env>
			: never
		: never

type ParseBetweenAfterL<Tokens extends ParserMonad, L extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"between">
		? SkipToken<Tokens> extends infer Rb extends ParserMonad
			? ParseAddScalarUntyped<Rb, Env> extends [
					infer Rlow extends ParserMonad,
					infer Low,
					infer EnvLow extends ExprParseEnv,
				]
				? Low extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<Rlow, Low, EnvLow>
					: PeekToken<Rlow> extends TokenKey<"and">
						? SkipToken<Rlow> extends infer Ra extends ParserMonad
							? ParseOtherOpScalarUntyped<Ra, EnvLow> extends [
									infer Rh extends ParserMonad,
									infer High,
									infer EnvH extends ExprParseEnv,
								]
								? High extends DbtyperErrorShape
									? SkipFailedExpressionWithEnv<Rh, High, EnvH>
									: [Rh, { kind: "between"; expr: L; low: Low; high: High }, EnvH]
								: never
							: never
						: SkipFailedExpressionWithEnv<
								Rlow,
								FormatError<Errors["EXPECTED_AND_BETWEEN_BETWEEN_BOUNDS"], []>,
								EnvLow
							>
				: never
			: never
		: never

type ParseLikeAfterL<
	Tokens extends ParserMonad,
	L extends ScalarExprAst,
	CI extends boolean,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends infer TokKw
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? TokKw extends TokenKey<"similar">
				? PeekToken<R1> extends TokenKey<"to"> // PGT-23: `x SIMILAR TO pattern`
					? ParseLikePattern<SkipToken<R1>, L, CI, Env>
					: SkipFailedExpressionWithEnv<R1, FormatError<Errors["UNEXPECTED_TOKEN"], ["SIMILAR"]>, Env>
				: TokKw extends TokenIdent<"regexp">
					? // SQLT-34: always an error until users can declare functions (FN-Q1)
						SkipFailedExpressionWithEnv<R1, FormatError<Errors["REGEXP_NEEDS_FUNCTION"], []>, Env>
					: ParseLikePattern<R1, L, CI, Env>
			: never
		: never

type ParseLikePattern<
	Tokens extends ParserMonad,
	L extends ScalarExprAst,
	CI extends boolean,
	Env extends ExprParseEnv,
> =
	ParseOtherOpScalarUntyped<Tokens, Env> extends [
		infer R2 extends ParserMonad,
		infer Pat,
		infer Env2 extends ExprParseEnv,
	]
		? Pat extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R2, Pat, Env2>
			: PeekToken<R2> extends TokenIdent<"escape">
				? ParseOtherOpScalarUntyped<SkipToken<R2>, Env2> extends [
						infer R3 extends ParserMonad,
						infer Esc,
						infer Env3 extends ExprParseEnv,
					]
					? Esc extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<R3, Esc, Env3>
						: [R3, { kind: "like"; expr: L; pattern: Pat; case_insensitive: CI }, Env3]
					: never
				: [R2, { kind: "like"; expr: L; pattern: Pat; case_insensitive: CI }, Env2]
		: never

/** `x NOT LIKE | GLOB | REGEXP | IN | BETWEEN …`: the positive form, negated. `Tokens` is at `NOT`. */
type ParseNotPostfix<Tokens extends ParserMonad, L extends ScalarExprAst, Env extends ExprParseEnv> =
	SkipToken<Tokens> extends infer R1 extends ParserMonad
		? PeekToken<R1> extends TokenKey<"like" | "similar"> | TokenIdent<"glob" | "regexp">
			? ParseLikeAfterL<R1, L, false, Env> extends [
					infer R2 extends ParserMonad,
					infer Inner,
					infer Env2 extends ExprParseEnv,
				]
				? NegateParsed<R2, Inner, Env2>
				: never
			: PeekToken<R1> extends TokenKey<"in">
				? ParseInListUntypedAfterInKw<R1, L, Env> extends [
						infer R2 extends ParserMonad,
						infer Inner,
						infer Env2 extends ExprParseEnv,
					]
					? NegateParsed<R2, Inner, Env2>
					: never
				: PeekToken<R1> extends TokenKey<"between">
					? ParseBetweenAfterL<R1, L, Env> extends [
							infer R2 extends ParserMonad,
							infer Inner,
							infer Env2 extends ExprParseEnv,
						]
						? NegateParsed<R2, Inner, Env2>
						: never
					: SkipFailedExpressionWithEnv<
							R1,
							FormatError<Errors["EXPECTED_LIKE_IN_OR_BETWEEN_AFTER_NOT"], []>,
							Env
						>
		: never

type NegateParsed<Tokens extends ParserMonad, Inner, Env extends ExprParseEnv> = Inner extends DbtyperErrorShape
	? SkipFailedExpressionWithEnv<Tokens, Inner, Env>
	: [Tokens, { kind: "not"; inner: Inner }, Env]

type ParseCaseExpectEndKeyword<
	Tokens extends ParserMonad,
	Acc extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	ElseB extends ScalarExprAst | null,
	Disc extends ScalarExprAst | null,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"end">
		? SkipToken<Tokens> extends infer Rend extends ParserMonad
			? Acc extends readonly []
				? SkipFailedExpressionWithEnv<Rend, FormatError<Errors["CASE_REQUIRES_AT_LEAST_ONE_WHEN"], []>, Env>
				: Disc extends null
					? [Rend, { kind: "case_searched"; arms: Acc; else_: ElseB }, Env]
					: [Rend, { kind: "case_simple"; discriminant: Disc; arms: Acc; else_: ElseB }, Env]
			: never
		: SkipFailedExpressionWithEnv<Tokens, FormatError<Errors["EXPECTED_END_AFTER_CASE"], []>, Env>

type ParseCaseAfterOneArm<
	Tokens extends ParserMonad,
	Acc extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	Disc extends ScalarExprAst | null,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"when">
		? ParseCaseWhenArmsThenElseEnd<Tokens, Acc, Disc, Env>
		: PeekToken<Tokens> extends TokenKey<"else">
			? SkipToken<Tokens> extends infer Re extends ParserMonad
				? ParseOrScalarUntyped<Re, Env> extends [
						infer Rel extends ParserMonad,
						infer Ea,
						infer EnvEa extends ExprParseEnv,
					]
					? Ea extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<Rel, Ea, EnvEa>
						: Ea extends ScalarExprAst
							? ParseCaseExpectEndKeyword<Rel, Acc, Ea, Disc, EnvEa>
							: never
					: never
				: never
			: PeekToken<Tokens> extends TokenKey<"end">
				? ParseCaseExpectEndKeyword<Tokens, Acc, null, Disc, Env>
				: SkipFailedExpressionWithEnv<Tokens, FormatError<Errors["EXPECTED_WHEN_ELSE_OR_END_IN_CASE"], []>, Env>

type ParseCaseWhenArmsThenElseEnd<
	Tokens extends ParserMonad,
	Acc extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	Disc extends ScalarExprAst | null,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"when">
		? SkipToken<Tokens> extends infer Rw extends ParserMonad
			? ParseOrScalarUntyped<Rw, Env> extends [
					infer Rcond extends ParserMonad,
					infer Wast,
					infer EnvW extends ExprParseEnv,
				]
				? Wast extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<Rcond, Wast, EnvW>
					: Wast extends ScalarExprAst
						? PeekToken<Rcond> extends TokenKey<"then">
							? SkipToken<Rcond> extends infer Rt extends ParserMonad
								? ParseOrScalarUntyped<Rt, EnvW> extends [
										infer Rth extends ParserMonad,
										infer Thast,
										infer EnvTh extends ExprParseEnv,
									]
									? Thast extends DbtyperErrorShape
										? SkipFailedExpressionWithEnv<Rth, Thast, EnvTh>
										: Thast extends ScalarExprAst
											? ParseCaseAfterOneArm<
													Rth,
													readonly [...Acc, { when: Wast; then: Thast }],
													Disc,
													EnvTh
												>
											: never
									: never
								: never
							: SkipFailedExpressionWithEnv<
									Rcond,
									FormatError<Errors["EXPECTED_THEN_AFTER_CASE_WHEN"], []>,
									EnvW
								>
						: never
				: never
			: never
		: never

/** After `CASE` keyword: searched `CASE WHEN` or simple `CASE expr WHEN`. */
type ParseCaseAfterCaseKw<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"when">
		? ParseCaseWhenArmsThenElseEnd<Tokens, readonly [], null, Env>
		: ParseOrScalarUntyped<Tokens, Env> extends [
					infer Rd extends ParserMonad,
					infer Dast,
					infer EnvD extends ExprParseEnv,
			  ]
			? Dast extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<Rd, Dast, EnvD>
				: Dast extends ScalarExprAst
					? PeekToken<Rd> extends TokenKey<"when">
						? ParseCaseWhenArmsThenElseEnd<Rd, readonly [], Dast, EnvD>
						: SkipFailedExpressionWithEnv<
								Rd,
								FormatError<Errors["EXPECTED_WHEN_AFTER_CASE_EXPRESSION"], []>,
								EnvD
							>
					: never
			: never

type ParseAfterIsUntyped<Tokens extends ParserMonad, L extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"not">
		? SkipToken<Tokens> extends infer R5 extends ParserMonad
			? PeekToken<R5> extends TokenKey<"null">
				? [SkipToken<R5>, { kind: "is_not_null"; expr: L }, Env]
				: DialectFact<Env["db"], "isOperand"> extends "value"
					? ParseIsValueOperand<R5, L, Env>
					: SkipFailedExpressionWithEnv<R5, FormatError<Errors["EXPECTED_NULL_AFTER_IS_NOT"], []>, Env>
			: never
		: PeekToken<Tokens> extends TokenKey<"null">
			? [SkipToken<Tokens>, { kind: "is_null"; expr: L }, Env]
			: DialectFact<Env["db"], "isOperand"> extends "value"
				? ParseIsValueOperand<Tokens, L, Env>
				: SkipFailedExpressionWithEnv<Tokens, FormatError<Errors["EXPECTED_NULL_AFTER_IS"], []>, Env>

/** SQLT-33: `a IS [NOT] b` and `a IS [NOT] DISTINCT FROM b`: any value on the right; the result is never NULL. */
type ParseIsValueOperand<Tokens extends ParserMonad, L extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"distinct">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"from">
				? ParseIsRhs<SkipToken<R1>, L, Env>
				: SkipFailedExpressionWithEnv<R1, FormatError<Errors["EXPECTED_FROM_AFTER_IS_DISTINCT"], []>, Env>
			: never
		: ParseIsRhs<Tokens, L, Env>

type ParseIsRhs<Tokens extends ParserMonad, L extends ScalarExprAst, Env extends ExprParseEnv> =
	ParseOtherOpScalarUntyped<Tokens, Env> extends [
		infer R1 extends ParserMonad,
		infer Rhs,
		infer Env1 extends ExprParseEnv,
	]
		? Rhs extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R1, Rhs, Env1>
			: [R1, { kind: "is_cmp"; left: L; right: Rhs }, Env1]
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

type ParseAnyAllSomeAfterOp<Tokens extends ParserMonad, L extends ScalarExprAst, OpToken, Env extends ExprParseEnv> =
	DbDialectOnlyError<Env["db"], "pg-any-all-some"> extends infer OnlyErr extends DbtyperErrorShape
		? SkipFailedExpressionWithEnv<Tokens, OnlyErr, Env>
		: ParseAnyAllSomeAfterOpPg<Tokens, L, OpToken, Env>

type ParseAnyAllSomeAfterOpPg<Tokens extends ParserMonad, L extends ScalarExprAst, OpToken, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends infer Kw
		? Kw extends TokenKey<"any"> | TokenKey<"all"> | TokenKey<"some">
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<"(">
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? PeekToken<R2> extends TokenKey<"select">
							? ParseParenEnclosedSelect<R2, Env["db"], Env["params"], Env["outerScope"]> extends [
									infer R3 extends ParserMonad,
									infer Sub,
								]
								? Sub extends DbtyperErrorShape
									? SkipFailedExpressionWithEnv<R3, Sub, Env>
									: Sub extends JsqlSelectStatementResult
										? TokenToCmpOp<OpToken> extends infer Op extends ScalarCmpOp
											? Kw extends TokenKey<"any">
												? [R3, { kind: "any_op"; op: Op; left: L; right: Sub }, Env]
												: Kw extends TokenKey<"all">
													? [R3, { kind: "all_op"; op: Op; left: L; right: Sub }, Env]
													: Kw extends TokenKey<"some">
														? [R3, { kind: "some_op"; op: Op; left: L; right: Sub }, Env]
														: never
											: SkipFailedExpressionWithEnv<R3, never, Env>
										: never
								: never
							: ParseOrScalarUntyped<R2, Env> extends [
										infer R4 extends ParserMonad,
										infer ArrExpr,
										infer Env4 extends ExprParseEnv,
								  ]
								? ArrExpr extends DbtyperErrorShape
									? SkipFailedExpressionWithEnv<R4, ArrExpr, Env4>
									: ArrExpr extends ScalarExprAst
										? PeekToken<R4> extends TokenKey<")">
											? SkipToken<R4> extends infer R5 extends ParserMonad
												? TokenToCmpOp<OpToken> extends infer Op extends ScalarCmpOp
													? Kw extends TokenKey<"any">
														? [
																R5,
																{ kind: "any_op"; op: Op; left: L; right: ArrExpr },
																Env4,
															]
														: Kw extends TokenKey<"all">
															? [
																	R5,
																	{ kind: "all_op"; op: Op; left: L; right: ArrExpr },
																	Env4,
																]
															: Kw extends TokenKey<"some">
																? [
																		R5,
																		{
																			kind: "some_op"
																			op: Op
																			left: L
																			right: ArrExpr
																		},
																		Env4,
																	]
																: never
													: SkipFailedExpressionWithEnv<R5, never, Env4>
												: never
											: SkipFailedExpressionWithEnv<
													R4,
													FormatError<
														Errors["EXPECTED_CLOSE_PAREN_AFTER_ANY_ALL_SOME_EXPRESSION"],
														[]
													>,
													Env4
												>
										: never
								: never
						: never
					: SkipFailedExpressionWithEnv<
							R1,
							FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_ANY_ALL_SOME"], []>,
							Env
						>
				: never
			: never
		: never

type ParseAfterAddScalarRelIsInUntyped<Tokens extends ParserMonad, L extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends infer P
		? IsRelOp<P> extends true
			? SkipToken<Tokens> extends infer R2 extends ParserMonad
				? PeekToken<R2> extends TokenKey<"any"> | TokenKey<"all"> | TokenKey<"some">
					? ParseAnyAllSomeAfterOp<R2, L, P, Env>
					: ParseOtherOpScalarUntyped<R2, Env> extends [
								infer R3 extends ParserMonad,
								infer Rhs,
								infer Env3 extends ExprParseEnv,
						  ]
						? Rhs extends DbtyperErrorShape
							? SkipFailedExpressionWithEnv<R3, Rhs, Env3>
							: TokenToCmpOp<P> extends infer Cop extends ScalarCmpOp
								? [R3, { kind: "cmp"; op: Cop; left: L; right: Rhs }, Env3]
								: SkipFailedExpressionWithEnv<R3, never, Env3>
						: never
				: never
			: P extends TokenKey<"is">
				? ParseAfterIsUntyped<SkipToken<Tokens>, L, Env>
				: P extends TokenKey<"in">
					? ParseInListUntypedAfterInKw<Tokens, L, Env>
					: P extends TokenKey<"between">
						? ParseBetweenAfterL<Tokens, L, Env>
						: P extends TokenKey<"~">
							? SkipToken<Tokens> extends infer Rregex extends ParserMonad
								? ParseOtherOpScalarUntyped<Rregex, Env> extends [
										infer Rrp extends ParserMonad,
										infer Pat,
										infer EnvRp extends ExprParseEnv,
									]
									? Pat extends DbtyperErrorShape
										? SkipFailedExpressionWithEnv<Rrp, Pat, EnvRp>
										: [
												Rrp,
												{
													kind: "pg_regex_match"
													expr: L
													pattern: Pat
													case_insensitive: false
												},
												EnvRp,
											]
									: never
								: never
							: P extends TokenKey<"~*">
								? SkipToken<Tokens> extends infer Rregexi extends ParserMonad
									? ParseOtherOpScalarUntyped<Rregexi, Env> extends [
											infer Rrpi extends ParserMonad,
											infer Pati,
											infer EnvRpi extends ExprParseEnv,
										]
										? Pati extends DbtyperErrorShape
											? SkipFailedExpressionWithEnv<Rrpi, Pati, EnvRpi>
											: [
													Rrpi,
													{
														kind: "pg_regex_match"
														expr: L
														pattern: Pati
														case_insensitive: true
													},
													EnvRpi,
												]
										: never
									: never
								: P extends TokenKey<"!~">
									? SkipToken<Tokens> extends infer Rnotregex extends ParserMonad
										? ParseOtherOpScalarUntyped<Rnotregex, Env> extends [
												infer Rrpn extends ParserMonad,
												infer Patn,
												infer EnvRpn extends ExprParseEnv,
											]
											? Patn extends DbtyperErrorShape
												? SkipFailedExpressionWithEnv<Rrpn, Patn, EnvRpn>
												: [
														Rrpn,
														{
															kind: "not"
															inner: {
																kind: "pg_regex_match"
																expr: L
																pattern: Patn
																case_insensitive: false
															}
														},
														EnvRpn,
													]
											: never
										: never
									: P extends TokenKey<"!~*">
										? SkipToken<Tokens> extends infer Rnotregexi extends ParserMonad
											? ParseOtherOpScalarUntyped<Rnotregexi, Env> extends [
													infer Rrpni extends ParserMonad,
													infer Patni,
													infer EnvRpni extends ExprParseEnv,
												]
												? Patni extends DbtyperErrorShape
													? SkipFailedExpressionWithEnv<Rrpni, Patni, EnvRpni>
													: [
															Rrpni,
															{
																kind: "not"
																inner: {
																	kind: "pg_regex_match"
																	expr: L
																	pattern: Patni
																	case_insensitive: true
																}
															},
															EnvRpni,
														]
												: never
											: never
										: P extends TokenKey<"like" | "similar">
											? ParseLikeAfterL<Tokens, L, false, Env>
											: P extends TokenKey<"ilike">
												? ParseLikeAfterL<Tokens, L, true, Env>
												: P extends TokenKey<"not">
													? Env extends { noPostfixNot: true }
														? [Tokens, L, Env] // `DEFAULT 18 NOT NULL`: NOT belongs to the column constraint
														: ParseNotPostfix<Tokens, L, Env>
													: P extends TokenIdent<"glob" | "regexp">
														? DialectFact<Env["db"], "globRegexp"> extends true
															? ParseLikeAfterL<Tokens, L, false, Env>
															: [Tokens, L, Env]
														: [Tokens, L, Env]
		: never

type ParseRelScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseOtherOpScalarUntyped<Tokens, Env> extends [
		infer R1 extends ParserMonad,
		infer E1,
		infer Env1 extends ExprParseEnv,
	]
		? E1 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R1, E1, Env1>
			: E1 extends ScalarExprAst
				? ParseAfterAddScalarRelIsInUntyped<R1, E1, Env1>
				: never
		: never

type ParseNotScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"exists">
		? SkipToken<Tokens> extends infer Rex0 extends ParserMonad
			? PeekToken<Rex0> extends TokenKey<"(">
				? SkipToken<Rex0> extends infer Rex1 extends ParserMonad
					? PeekToken<Rex1> extends TokenKey<"select">
						? ParseParenEnclosedSelect<Rex1, Env["db"], Env["params"], Env["outerScope"]> extends [
								infer Rex2 extends ParserMonad,
								infer Sub,
							]
							? Sub extends DbtyperErrorShape
								? SkipFailedExpressionWithEnv<Rex2, Sub, Env>
								: Sub extends JsqlSelectStatementResult
									? [Rex2, { kind: "exists_subquery"; sub: Sub }, Env]
									: never
							: never
						: SkipFailedExpressionWithEnv<
								Rex1,
								FormatError<Errors["EXPECTED_SELECT_IN_EXISTS_SUBQUERY"], []>,
								Env
							>
					: never
				: SkipFailedExpressionWithEnv<Rex0, FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_EXISTS"], []>, Env>
			: never
		: PeekToken<Tokens> extends TokenKey<"not">
			? SkipToken<Tokens> extends infer Rn extends ParserMonad
				? ParseNotScalarUntyped<Rn, Env> extends [
						infer Ru extends ParserMonad,
						infer U,
						infer EnvU extends ExprParseEnv,
					]
					? U extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<Ru, U, EnvU>
						: U extends ScalarExprAst
							? [Ru, { kind: "not"; inner: U }, EnvU]
							: never
					: never
				: never
			: ParseRelScalarUntyped<Tokens, Env>

/**
 * `a AND b AND c …` / `a OR b OR c …` become a BALANCED tree of binary nodes (depth log2 n), not the left-nested one.
 * A left-nested tree of n operators is n levels deep, and every walk over it (the resolver, `extends ScalarExprAst`
 * checks) nests one instantiation level per operator: TS2589 / TS2321 at about 40 operators (#105, one long WHERE).
 * AND and OR are associative for typing (boolean, nullable when any operand is, first error in source order), so
 * the shape of the tree changes nothing but its depth.
 *
 * The operands are collected tail-recursively (as #48 did with ForceProps) in a short tuple `Items`; every
 * {@link BoolChainChunk} operands it is balanced into one node and moved to `Done`. Two things are required (#105):
 * a tuple that grows by one at every operator is copied n times, which makes the instantiation count quadratic
 * (TS2589 at about 240 operators), and a nested cons list instead of a tuple is itself deeper than the instantiation
 * depth limit. Do not return to an accumulating node or to one unbounded accumulator.
 */
type BoolChainChunk = 16

type BalanceBoolChain<K extends "and" | "or", Items extends readonly unknown[]> = Items extends readonly [
	infer Only extends ScalarExprAst,
]
	? Only
	: BalanceBoolChain<K, PairBoolChain<K, Items>>

type PairBoolChain<
	K extends "and" | "or",
	Items extends readonly unknown[],
	Out extends readonly unknown[] = [],
> = Items extends readonly [infer A, infer B, ...infer T]
	? PairBoolChain<K, T, [...Out, { kind: K; left: A; right: B }]>
	: [...Out, ...Items]

/** Adds one operand; a full chunk is balanced into one node of `Done`. */
type PushBoolOperand<
	K extends "and" | "or",
	Items extends readonly unknown[],
	Done extends readonly unknown[],
	E,
> = Items["length"] extends BoolChainChunk ? [[], [...Done, BalanceBoolChain<K, [...Items, E]>]] : [[...Items, E], Done]

type FinishBoolChain<
	K extends "and" | "or",
	Items extends readonly unknown[],
	Done extends readonly unknown[],
> = Items extends readonly [] ? BalanceBoolChain<K, Done> : BalanceBoolChain<K, [...Done, BalanceBoolChain<K, Items>]>

type ParseAndLoopScalarUntyped<
	Tokens extends ParserMonad,
	Items extends readonly unknown[],
	Done extends readonly unknown[],
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"and">
		? ParseNotScalarUntyped<SkipToken<Tokens>, Env> extends [
				infer R2 extends ParserMonad,
				infer E1,
				infer Env1 extends ExprParseEnv,
			]
			? E1 extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<R2, E1, Env1>
				: PushBoolOperand<"and", Items, Done, E1> extends [
							infer I2 extends readonly unknown[],
							infer D2 extends readonly unknown[],
					  ]
					? ParseAndLoopScalarUntyped<R2, I2, D2, Env1>
					: never
			: never
		: [Tokens, FinishBoolChain<"and", Items, Done>, Env]

type ParseAndScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseNotScalarUntyped<Tokens, Env> extends [infer R0 extends ParserMonad, infer E0, infer Env0 extends ExprParseEnv]
		? E0 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R0, E0, Env0>
			: E0 extends ScalarExprAst
				? ParseAndLoopScalarUntyped<R0, [E0], [], Env0>
				: never
		: never

type ParseOrLoopScalarUntyped<
	Tokens extends ParserMonad,
	Items extends readonly unknown[],
	Done extends readonly unknown[],
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"or">
		? ParseAndScalarUntyped<SkipToken<Tokens>, Env> extends [
				infer R2 extends ParserMonad,
				infer E1,
				infer Env1 extends ExprParseEnv,
			]
			? E1 extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<R2, E1, Env1>
				: PushBoolOperand<"or", Items, Done, E1> extends [
							infer I2 extends readonly unknown[],
							infer D2 extends readonly unknown[],
					  ]
					? ParseOrLoopScalarUntyped<R2, I2, D2, Env1>
					: never
			: never
		: [Tokens, FinishBoolChain<"or", Items, Done>, Env]

export type ParseOrScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseAndScalarUntyped<Tokens, Env> extends [infer R0 extends ParserMonad, infer E0, infer Env0 extends ExprParseEnv]
		? E0 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R0, E0, Env0>
			: E0 extends ScalarExprAst
				? ParseOrLoopScalarUntyped<R0, [E0], [], Env0>
				: never
		: never

export type ParseExpressionAST<Tokens extends ParserMonad, Env extends ExprParseEnv> = ParseOrScalarUntyped<Tokens, Env>

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
					: E extends {
								kind: "pg_cast"
								expr: infer Ic extends ScalarExprAst
								type_parts: infer Pc extends readonly string[]
						  }
						? SqlCastTypeNorm<Pc> extends infer Nc extends string
							? Nc extends "text" | "varchar" | "character varying" | "char"
								? true
								: ScalarAstNonNumericForMulHead<Ic>
							: ScalarAstNonNumericForMulHead<Ic>
						: E extends {
									kind: "sql_cast"
									expr: infer Ics extends ScalarExprAst
									type_parts: infer Pcs extends readonly string[]
							  }
							? SqlCastTypeNorm<Pcs> extends infer Ncs extends string
								? Ncs extends "text" | "varchar" | "character varying" | "char"
									? true
									: ScalarAstNonNumericForMulHead<Ics>
								: ScalarAstNonNumericForMulHead<Ics>
							: E extends { kind: "exists_subquery" }
								? true
								: E extends { kind: "in_subquery" }
									? true
									: E extends { kind: "array_ctor" }
										? true
										: E extends { kind: "array_index" }
											? true
											: false

/** Comma-separated contents of `ARRAY[ … ]`. */
type ParseArrayCtorElementsAccum<
	Tokens extends ParserMonad,
	Acc extends readonly ScalarExprAst[],
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"]">
		? [SkipToken<Tokens>, Acc, Env]
		: ParseOrScalarUntyped<Tokens, Env> extends [
					infer R1 extends ParserMonad,
					infer Ele,
					infer Env1 extends ExprParseEnv,
			  ]
			? Ele extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<R1, Ele, Env1>
				: Ele extends ScalarExprAst
					? PeekToken<R1> extends TokenKey<"]">
						? [SkipToken<R1>, readonly [...Acc, Ele], Env1]
						: PeekToken<R1> extends TokenKey<",">
							? ParseArrayCtorElementsAccum<SkipToken<R1>, readonly [...Acc, Ele], Env1>
							: SkipFailedExpressionWithEnv<
									R1,
									FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_BRACKET_IN_ARRAY_CONSTRUCTOR"], []>,
									Env1
								>
					: never
			: never

type ParseArrayCtorAfterArrayKw<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"[">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"]">
				? [SkipToken<R1>, { kind: "array_ctor"; elements: readonly [] }, Env]
				: ParseArrayCtorElementsAccum<R1, readonly [], Env> extends [
							infer R2 extends ParserMonad,
							infer Out,
							infer Env2 extends ExprParseEnv,
					  ]
					? Out extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<R2, Out, Env2>
						: Out extends readonly ScalarExprAst[]
							? [R2, { kind: "array_ctor"; elements: Out }, Env2]
							: never
					: never
			: never
		: never

type ParsePostfixArrayIndexTail<Tokens extends ParserMonad, Acc extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"[">
		? SkipToken<Tokens> extends infer Ri extends ParserMonad
			? ParseOrScalarUntyped<Ri, Env> extends [
					infer Rj extends ParserMonad,
					infer Idx,
					infer EnvIdx extends ExprParseEnv,
				]
				? Idx extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<Rj, Idx, EnvIdx>
					: Idx extends ScalarExprAst
						? PeekToken<Rj> extends TokenKey<"]">
							? ParsePostfixArrayIndexTail<
									SkipToken<Rj>,
									{ kind: "array_index"; base: Acc; index: Idx },
									EnvIdx
								>
							: SkipFailedExpressionWithEnv<
									Rj,
									FormatError<Errors["EXPECTED_CLOSE_BRACKET_AFTER_ARRAY_SUBSCRIPT"], []>,
									EnvIdx
								>
						: never
				: never
			: never
		: [Tokens, Acc, Env]

type TryParenOperandScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"(">
		? SkipToken<Tokens> extends infer Ri extends ParserMonad
			? PeekToken<Ri> extends TokenKey<"select">
				? ParseParenScalarSelect<Ri, Env["db"], Env["params"], Env["outerScope"]> extends [
						infer Rk extends ParserMonad,
						infer Sub,
					]
					? Sub extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<Rk, Sub, Env>
						: Sub extends JsqlSelectStatementResult
							? [Rk, { kind: "scalar_subquery"; sel: Sub }, Env]
							: never
					: never
				: PeekToken<Ri> extends TokenKey<"with">
					? ParseParenScalarSelect<Ri, Env["db"], Env["params"], Env["outerScope"]> extends [
							infer Rw extends ParserMonad,
							infer Subw,
						]
						? Subw extends DbtyperErrorShape
							? SkipFailedExpressionWithEnv<Rw, Subw, Env>
							: Subw extends JsqlSelectStatementResult
								? [Rw, { kind: "scalar_subquery"; sel: Subw }, Env]
								: never
						: never
					: ParseOrScalarUntyped<Ri, Env> extends [
								infer Rj extends ParserMonad,
								infer Ej,
								infer EnvJ extends ExprParseEnv,
						  ]
						? Ej extends DbtyperErrorShape
							? SkipFailedExpressionWithEnv<Rj, Ej, EnvJ>
							: PeekToken<Rj> extends infer TokCl
								? SkipToken<Rj> extends infer Rk2 extends ParserMonad
									? TokCl extends TokenKey<")">
										? [Rk2, Ej, EnvJ]
										: SkipFailedExpressionWithEnv<
												Rk2,
												FormatError<Errors["EXPECTED_CLOSE_PAREN"], []>,
												EnvJ
											>
									: never
								: never
						: never
			: never
		: never

type TryOperandScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"cast">
		? ParseCastKeywordOperand<Tokens, Env>
		: PeekToken<Tokens> extends TokenKey<"case">
			? ParseCaseAfterCaseKw<SkipToken<Tokens>, Env>
			: PeekToken<Tokens> extends TokenKey<"array">
				? SkipToken<Tokens> extends infer RarrKw extends ParserMonad
					? ParseArrayCtorAfterArrayKw<RarrKw, Env> extends [
							infer Rarr extends ParserMonad,
							infer ArrOut,
							infer EnvArr extends ExprParseEnv,
						]
						? ArrOut extends DbtyperErrorShape
							? SkipFailedExpressionWithEnv<Rarr, ArrOut, EnvArr>
							: ArrOut extends ScalarExprAst
								? [Rarr, ArrOut, EnvArr]
								: never
						: never
					: never
				: PeekToken<Tokens> extends TokenKey<"(">
					? TryParenOperandScalarUntyped<Tokens, Env>
					: PeekToken<Tokens> extends TokenKey<"current_timestamp" | "current_date" | "current_time">
						? PeekToken<Tokens> extends TokenKey<infer Word extends string>
							? [SkipToken<Tokens>, { kind: "function_call"; name: Word; args: readonly [] }, Env]
							: never
						: PeekToken<Tokens> extends TokenKey<"true">
							? [SkipToken<Tokens>, { kind: "true" }, Env]
							: PeekToken<Tokens> extends TokenKey<"false">
								? [SkipToken<Tokens>, { kind: "false" }, Env]
								: PeekToken<Tokens> extends TokenKey<"null">
									? [SkipToken<Tokens>, { kind: "sql_null" }, Env]
									: PeekToken<Tokens> extends TokenString<infer Str>
										? [
												SkipToken<Tokens>,
												PeekToken<Tokens> extends { blob: true }
													? { kind: "string"; value: Str; blob: true }
													: { kind: "string"; value: Str },
												Env,
											]
										: PeekToken<Tokens> extends TokenNumber<infer Raw>
											? [SkipToken<Tokens>, { kind: "number"; raw: Raw }, Env]
											: PeekToken<Tokens> extends TokenParam<infer P>
												? [SkipToken<Tokens>, { kind: "param"; name: P }, Env]
												: PeekToken<Tokens> extends TokenIndexedParam<infer Index>
													? [
															SkipToken<Tokens>,
															{
																kind: "positional-param"
																index: Dec<ParseNumber<Index>>
															},
															Env,
														]
													: AsIdent<PeekToken<Tokens>> extends TokenIdent<string>
														? TryColumnOperandScalarUntyped<Tokens, Env>
														: PeekToken<Tokens> extends TokenType<infer _Kind, infer Value>
															? SkipFailedExpressionWithEnv<
																	Tokens,
																	FormatError<Errors["UNEXPECTED_TOKEN"], [Value]>,
																	Env
																>
															: never

/** PGT-30: type names that start a typed literal (`interval '1 day'`, `date '2020-01-01'`). */
type TypedLiteralName = "interval" | "date" | "timestamp" | "timestamptz" | "time"

type TypedLiteralCast<TypeName extends string, Lit extends string> = {
	kind: "pg_cast"
	expr: { kind: "string"; value: Lit }
	type_parts: readonly [TypeName]
}

/** After a typed literal: the cast, and the arithmetic that follows it. */
type TypedLiteralTail<
	Tokens extends ParserMonad,
	TypeName extends string,
	Lit extends string,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends ArithOpToken
		? ParseArithTailAfterFirstScalarUntyped<Tokens, TypedLiteralCast<TypeName, Lit>, Env>
		: [Tokens, TypedLiteralCast<TypeName, Lit>, Env]

/** EXPR-2, EXPR-5, EXPR-6: a column reference as a right operand or unary-minus operand. */
type TryColumnOperandScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	MaximalIdentChain<Tokens> extends [infer Rm extends ParserMonad, infer Parts, infer W extends string]
		? Parts extends ScalarIdentParts
			? PeekToken<Rm> extends TokenKey<"(">
				? SkipFailedExpressionWithEnv<Rm, FormatError<Errors["UNEXPECTED_TOKEN"], ["("]>, Env>
				: PeekToken<Rm> extends TokenString<infer Lit extends string>
					? Parts extends readonly [infer TypeName extends TypedLiteralName]
						? [SkipToken<Rm>, TypedLiteralCast<TypeName, Lit>, Env]
						: [Rm, { kind: "col"; parts: Parts; written: W }, Env]
					: [Rm, { kind: "col"; parts: Parts; written: W }, Env]
			: SkipFailedExpressionWithEnv<Rm, FormatError<Errors["UNEXPECTED_TOKEN"], ["*"]>, Env>
		: never

type ParseUnaryScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"-">
		? SkipToken<Tokens> extends infer Rn extends ParserMonad
			? ParseUnaryScalarUntyped<Rn, Env> extends [
					infer Ru extends ParserMonad,
					infer U,
					infer EnvU extends ExprParseEnv,
				]
				? U extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<Ru, U, EnvU>
					: U extends ScalarExprAst
						? [Ru, { kind: "neg"; inner: U }, EnvU]
						: never
				: never
			: never
		: TryOperandScalarUntyped<Tokens, Env> extends [
					infer Tu extends ParserMonad,
					infer Bu,
					infer EnvB extends ExprParseEnv,
			  ]
			? Bu extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<Tu, Bu, EnvB>
				: Bu extends ScalarExprAst
					? ParsePgCastSuffixTail<Tu, Bu> extends [
							infer Tp extends ParserMonad,
							infer Bp extends ScalarExprAst,
						]
						? ParsePostfixArrayIndexTail<Tp, Bp, EnvB>
						: never
					: never
			: never

type ParseMulLoopAfterFirstScalarUntyped<
	Tokens extends ParserMonad,
	Acc extends ScalarExprAst,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"*" | "/" | "%">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? ParseExpScalarUntyped<R1, Env> extends [
					infer R2 extends ParserMonad,
					infer E1,
					infer Env1 extends ExprParseEnv,
				]
				? E1 extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R2, E1, Env1>
					: E1 extends ScalarExprAst
						? PeekToken<Tokens> extends TokenKey<"%">
							? ParseMulLoopAfterFirstScalarUntyped<R2, { kind: "mod"; left: Acc; right: E1 }, Env1>
							: ParseMulLoopAfterFirstScalarUntyped<R2, { kind: "mul"; left: Acc; right: E1 }, Env1>
						: never
				: never
			: never
		: [Tokens, Acc, Env]

type ParseExpLoop<Tokens extends ParserMonad, Acc extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"^">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? ParseUnaryScalarUntyped<R1, Env> extends [
					infer R2 extends ParserMonad,
					infer E1,
					infer Env1 extends ExprParseEnv,
				]
				? E1 extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R2, E1, Env1>
					: E1 extends ScalarExprAst
						? ParseExpLoop<R2, { kind: "exp"; left: Acc; right: E1 }, Env1>
						: never
				: never
			: never
		: [Tokens, Acc, Env]

type ParseExpScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseUnaryScalarUntyped<Tokens, Env> extends [
		infer R0 extends ParserMonad,
		infer E0,
		infer Env0 extends ExprParseEnv,
	]
		? E0 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R0, E0, Env0>
			: E0 extends ScalarExprAst
				? ParseExpLoop<R0, E0, Env0>
				: never
		: never

type ParseMulScalarUntypedEntry<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseExpScalarUntyped<Tokens, Env> extends [infer R0 extends ParserMonad, infer E0, infer Env0 extends ExprParseEnv]
		? E0 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R0, E0, Env0>
			: E0 extends ScalarExprAst
				? ScalarAstNonNumericForMulHead<E0> extends true
					? PeekToken<R0> extends infer P
						? P extends
								| TokenKey<"+">
								| TokenKey<"-">
								| TokenKey<"*">
								| TokenKey<"/">
								| TokenKey<"%">
								| TokenKey<"^">
							? SkipFailedExpressionWithEnv<
									R0,
									FormatError<Errors["INCOMPATIBLE_TYPES_IN_ARITHMETIC"], []>,
									Env0
								>
							: [R0, E0, Env0]
						: never
					: ParseMulLoopAfterFirstScalarUntyped<R0, E0, Env0>
				: never
		: never

type IsCustomOperatorString<S extends string> = S extends ""
	? false
	: S extends `${infer C}${infer Rest}`
		? C extends "+" | "-" | "*" | "/" | "<" | ">" | "=" | "~" | "!" | "@" | "#" | "%" | "^" | "&" | "|" | "`" | "?"
			? Rest extends ""
				? true
				: IsCustomOperatorString<Rest>
			: false
		: false

type IsOtherOp<T> =
	T extends TokenKey<infer K extends string>
		? IsCustomOperatorString<K> extends true
			? K extends
					| "+"
					| "-"
					| "*"
					| "/"
					| "%"
					| "^"
					| "="
					| "<>"
					| "!="
					| "<="
					| ">="
					| "<"
					| ">"
					| "~"
					| "~*"
					| "!~"
					| "!~*"
				? false
				: true
			: false
		: false

type ParseOtherOpLoop<Tokens extends ParserMonad, Acc extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends infer P
		? IsOtherOp<P> extends true
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? P extends TokenKey<infer Op>
					? ParseAddScalarUntyped<R1, Env> extends [
							infer R2 extends ParserMonad,
							infer Rhs,
							infer Env2 extends ExprParseEnv,
						]
						? Rhs extends DbtyperErrorShape
							? SkipFailedExpressionWithEnv<R2, Rhs, Env2>
							: Rhs extends ScalarExprAst
								? ParseOtherOpLoop<R2, { kind: "custom_op"; op: Op; left: Acc; right: Rhs }, Env2>
								: never
						: never
					: never
				: never
			: PeekToken<Tokens> extends TokenIdent<"operator">
				? SkipToken<Tokens> extends infer R1 extends ParserMonad
					? PeekToken<R1> extends TokenKey<"(">
						? SkipToken<R1> extends infer R2 extends ParserMonad
							? PeekToken<R2> extends TokenKey<infer Op>
								? SkipToken<R2> extends infer R3 extends ParserMonad
									? PeekToken<R3> extends TokenKey<")">
										? SkipToken<R3> extends infer R4 extends ParserMonad
											? ParseAddScalarUntyped<R4, Env> extends [
													infer R5 extends ParserMonad,
													infer Rhs,
													infer Env5 extends ExprParseEnv,
												]
												? Rhs extends DbtyperErrorShape
													? SkipFailedExpressionWithEnv<R5, Rhs, Env5>
													: Rhs extends ScalarExprAst
														? ParseOtherOpLoop<
																R5,
																{ kind: "custom_op"; op: Op; left: Acc; right: Rhs },
																Env5
															>
														: never
												: never
											: never
										: SkipFailedExpressionWithEnv<
												R3,
												FormatError<
													Errors["EXPECTED_CLOSE_PAREN_AFTER_OPERATOR_OPEN_PAREN"],
													[]
												>,
												Env
											>
									: never
								: SkipFailedExpressionWithEnv<
										R2,
										FormatError<Errors["EXPECTED_OPERATOR_AFTER_OPERATOR_OPEN_PAREN"], []>,
										Env
									>
							: never
						: SkipFailedExpressionWithEnv<
								R1,
								FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_OPERATOR"], []>,
								Env
							>
					: never
				: [Tokens, Acc, Env]
		: [Tokens, Acc, Env]

export type ParseOtherOpScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseAddScalarUntyped<Tokens, Env> extends [infer R0 extends ParserMonad, infer E0, infer Env0 extends ExprParseEnv]
		? E0 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R0, E0, Env0>
			: E0 extends ScalarExprAst
				? ParseOtherOpLoop<R0, E0, Env0>
				: never
		: never

type ParseAddLoopAfterPlusScalarUntyped<
	Tokens extends ParserMonad,
	Acc extends ScalarExprAst,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"+">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? ParseMulScalarUntypedEntry<R1, Env> extends [
					infer R2 extends ParserMonad,
					infer E1,
					infer Env1 extends ExprParseEnv,
				]
				? E1 extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R2, E1, Env1>
					: E1 extends ScalarExprAst
						? ParseAddLoopAfterFirstScalarUntyped<R2, MergeScalarAstAddSub<"add", Acc, E1>, Env1>
						: never
				: never
			: never
		: never

type ParseAddLoopAfterMinusScalarUntyped<
	Tokens extends ParserMonad,
	Acc extends ScalarExprAst,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"-">
		? SkipToken<Tokens> extends infer R3 extends ParserMonad
			? ParseMulScalarUntypedEntry<R3, Env> extends [
					infer R4 extends ParserMonad,
					infer E2,
					infer Env2 extends ExprParseEnv,
				]
				? E2 extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R4, E2, Env2>
					: E2 extends ScalarExprAst
						? ParseAddLoopAfterFirstScalarUntyped<R4, MergeScalarAstAddSub<"sub", Acc, E2>, Env2>
						: never
				: never
			: never
		: never

type MergeScalarAstAddSub<Op extends "add" | "sub", L extends ScalarExprAst, R extends ScalarExprAst> = Op extends "add"
	? { kind: "add"; left: L; right: R }
	: { kind: "sub"; left: L; right: R }

type ParseAddLoopAfterFirstScalarUntyped<
	Tokens extends ParserMonad,
	Acc extends ScalarExprAst,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"+">
		? ParseAddLoopAfterPlusScalarUntyped<Tokens, Acc, Env>
		: PeekToken<Tokens> extends TokenKey<"-">
			? ParseAddLoopAfterMinusScalarUntyped<Tokens, Acc, Env>
			: [Tokens, Acc, Env]

type ArithOpToken = TokenKey<"+"> | TokenKey<"-"> | TokenKey<"*"> | TokenKey<"/"> | TokenKey<"%"> | TokenKey<"^">

/** After a leftmost operand: `^`, then `* / %`, then `+ -` (EXPR-5 precedence). */
type ParseArithTailAfterFirstScalarUntyped<
	Tokens extends ParserMonad,
	Acc extends ScalarExprAst,
	Env extends ExprParseEnv,
> =
	ParseExpLoop<Tokens, Acc, Env> extends [infer R1 extends ParserMonad, infer E1, infer Env1 extends ExprParseEnv]
		? E1 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R1, E1, Env1>
			: E1 extends ScalarExprAst
				? ParseMulLoopAfterFirstScalarUntyped<R1, E1, Env1> extends [
						infer R2 extends ParserMonad,
						infer E2,
						infer Env2 extends ExprParseEnv,
					]
					? E2 extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<R2, E2, Env2>
						: E2 extends ScalarExprAst
							? ParseAddLoopAfterFirstScalarUntyped<R2, E2, Env2>
							: never
					: never
				: never
		: never

type ParseScalarExprUntypedFromIdent<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	MaximalIdentChain<Tokens> extends [infer Rm extends ParserMonad, infer Parts, infer W extends string]
		? Parts extends readonly ["__ats__", infer Al extends string]
			? PeekToken<Rm> extends TokenKey<"(">
				? SkipBracketedUntil<SkipToken<Rm>, TokenKey<")">> extends [infer After extends ParserMonad, infer Rs]
					? Rs extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<After, FormatError<Errors["UNBALANCED_PARENTHESES"], []>, Env>
						: SkipFailedExpressionWithEnv<
								SkipToken<After>,
								FormatError<Errors["UNSUPPORTED_PARENTHESIZED_EXPRESSION"], []>,
								Env
							>
					: never
				: [Rm, { kind: "alias_table_star"; alias: Al }, Env]
			: Parts extends readonly ["__qts__", infer Sch extends string, infer Tab extends string]
				? PeekToken<Rm> extends TokenKey<"(">
					? SkipBracketedUntil<SkipToken<Rm>, TokenKey<")">> extends [
							infer After extends ParserMonad,
							infer Rs,
						]
						? Rs extends DbtyperErrorShape
							? SkipFailedExpressionWithEnv<After, FormatError<Errors["UNBALANCED_PARENTHESES"], []>, Env>
							: SkipFailedExpressionWithEnv<
									SkipToken<After>,
									FormatError<Errors["UNSUPPORTED_PARENTHESIZED_EXPRESSION"], []>,
									Env
								>
						: never
					: [Rm, { kind: "qualified_table_star"; schema: Sch; table: Tab }, Env]
				: Parts extends ScalarIdentParts
					? PeekToken<Rm> extends TokenKey<"(">
						? ParseCallArgs<SkipToken<Rm>, Parts, Env> extends [
								infer After extends ParserMonad,
								infer Args,
								infer EnvAfter extends ExprParseEnv,
							]
							? Args extends DbtyperErrorShape
								? SkipFailedExpressionWithEnv<After, Args, EnvAfter>
								: Args extends readonly (ScalarExprAst | { kind: "star" })[]
									? Parts extends readonly [infer FnName extends string]
										? ParseOptionalOverClause<After, FnName, Args, EnvAfter> extends [
												infer Rcall extends ParserMonad,
												infer Call,
												infer EnvCall extends ExprParseEnv,
											]
											? Call extends ScalarExprAst
												? PeekToken<Rcall> extends ArithOpToken
													? ParseArithTailAfterFirstScalarUntyped<Rcall, Call, EnvCall> // `now() - interval '1 day'`, `count(*) - 1`
													: [Rcall, Call, EnvCall]
												: [Rcall, Call, EnvCall]
											: never
										: SkipFailedExpressionWithEnv<
												After,
												FormatError<Errors["QUALIFIED_FUNCTION_NAMES_ARE_NOT_SUPPORTED"], []>,
												EnvAfter
											>
									: never
							: never
						: PeekToken<Rm> extends infer Pa
							? Pa extends TokenString<infer Lit extends string>
								? Parts extends readonly [infer TypeName extends TypedLiteralName]
									? TypedLiteralTail<SkipToken<Rm>, TypeName, Lit, Env>
									: [Rm, { kind: "col"; parts: Parts; written: W }, Env]
								: Pa extends TokenKey<"::">
									? ParsePgCastSuffixTail<Rm, { kind: "col"; parts: Parts; written: W }> extends [
											infer Rcast extends ParserMonad,
											infer Casted extends ScalarExprAst,
										]
										? PeekToken<Rcast> extends ArithOpToken
											? ParseArithTailAfterFirstScalarUntyped<Rcast, Casted, Env>
											: [Rcast, Casted, Env]
										: never
									: Pa extends ArithOpToken
										? ParseArithTailAfterFirstScalarUntyped<
												Rm,
												{ kind: "col"; parts: Parts; written: W },
												Env
											>
										: [Rm, { kind: "col"; parts: Parts; written: W }, Env]
							: never
					: never
		: never

type ParseScalarExprUntypedNonIdent<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseMulScalarUntypedEntry<Tokens, Env> extends [
		infer R0 extends ParserMonad,
		infer E0,
		infer Env0 extends ExprParseEnv,
	]
		? E0 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R0, E0, Env0>
			: E0 extends ScalarExprAst
				? ScalarAstNonNumericForMulHead<E0> extends true
					? PeekToken<R0> extends infer P
						? P extends TokenKey<"+"> | TokenKey<"-"> | TokenKey<"*">
							? SkipFailedExpressionWithEnv<
									R0,
									FormatError<Errors["INCOMPATIBLE_TYPES_IN_ARITHMETIC"], []>,
									Env0
								>
							: [R0, E0, Env0]
						: never
					: ParseAddLoopAfterFirstScalarUntyped<R0, E0, Env0>
				: never
		: never
