import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { DbDialectOnlyError, DialectFact, PgOnlyTypeNames, SqliteTypeKey } from "../core/dialect.ts"
import type { TokenIndexedParam, TokenParam, TokenType } from "../lexer/sql-lexer.ts"
import type { TokenNumber } from "../lexer/sql-lexer.ts"
import type { TokenString } from "../lexer/sql-lexer.ts"
import type { AsIdent, TokenEot, TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperError, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { ParseParenEnclosedSelect, ParseParenScalarSelect } from "./parse-select-subquery.ts"
import type { ResolveColumnRefValue } from "./resolve-column-ref.ts"
import type { SkipBracketedUntil, SkipFailedExpression, SkipFailedExpressionWithEnv } from "./skip-statement.ts"
import type {
	SqlTypeShape,
	SqlType,
	SqlText,
	SqlInteger,
	SqlBigint,
	SqlBoolean,
	SqlNumeric,
	SqlUuid,
	SqlNull,
	SqlUnknown,
	Nullable,
} from "../core/sql-type-shape.ts"
import type { EnumCastCheck, EnumComparisonCheck, EnumPeerCheck, WithEnumCheck } from "./parse-enum-checks.ts"
import type { ShapeComparisonClass, SqlComparisonClass, StringLiteralClasses } from "../core/comparison-classes.ts"
import type { ResolveUserType } from "./parse-sql-type-words.ts"
import type { Dec, Inc, ParseNumber } from "../core/type-utils.ts"
import type { ParamProbeFound, ProbeKeyOf, ProbeTypeFromPeer } from "../core/param-probe.ts"
import type {
	CatalogArityError,
	CatalogRow,
	CatalogRowResult,
	IsCatalogFunction,
	IsPeerTypedRow,
	IsWindowCapableRow,
	IsWindowOnlyRow,
	OtherDialectHints,
	OtherDialectTitle,
	RowArgType,
} from "./function-catalog.ts"
import type { SqliteRowResult } from "./function-catalog.ts"
import type { SqliteOperators } from "./sqlite-functions.ts"

/** Caller-supplied `:name` bindings (names must match lexer param identifiers). */
export type ExpressionParamsShape = Record<string, SqlTypeShape> | readonly SqlTypeShape[]

/** Default `Params` for parsers: `keyof` is `never` (plain `{}` widens against `Record<string, …>`). */
export type EmptyExpressionParams = Record<never, never>

/** Threaded through scalar parse for subqueries: catalog, `:param` bindings, outer aliases visible inside `(SELECT …)`. */
type ExprParseEnv = {
	db: JsqlDatabaseShape
	params: ExpressionParamsShape
	outerScope: ScopeMap
	/** Set while parsing an unparenthesized column DEFAULT: a following `NOT` is `NOT NULL`, not `NOT LIKE`. */
	noPostfixNot?: true
}

/** Identifier chain in a scalar expression AST (syntax only until {@link ResolveExpressionAST}). */
export type ScalarIdentParts = readonly [string] | readonly [string, string] | readonly [string, string, string]

/** Comparison operator in {@link ScalarExprAst} `cmp` (resolved like PostgreSQL class rules). */
type ScalarCmpOp = "eq" | "ne" | "lt" | "le" | "gt" | "ge"

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
type EnumBetweenCheck<
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

type SqlCastTypeNorm<P extends readonly string[]> = P extends readonly [
	infer H extends string,
	...infer T extends readonly string[],
]
	? T extends readonly []
		? Lowercase<H>
		: H extends `${string}.`
			? `${Lowercase<H>}${SqlCastTypeNorm<T>}` // `schema.type`: the dot joins without a space
			: `${Lowercase<H>} ${SqlCastTypeNorm<T>}`
	: string

/** SQLT-12: in a SQLite chain `CAST(x AS t)` gets the type of a column declared `t` (its affinity key, SQLT-6…SQLT-8). */
type CastTypeParts<Db, Parts extends readonly string[]> =
	DialectFact<Db, "typeNames"> extends "affinity" ? readonly [SqliteTypeKey<SqlCastTypeNorm<Parts>>] : Parts

/** SQLT-53: `CAST(x AS jsonb)` in a SQLite chain names the PostgreSQL-only type. */
type CastPgOnlyTypeError<Db, Parts extends readonly string[]> =
	DialectFact<Db, "typeNames"> extends "affinity"
		? SqlCastTypeNorm<Parts> extends infer T extends keyof PgOnlyTypeNames
			? DbDialectOnlyError<Db, PgOnlyTypeNames[T]>
			: null
		: null

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
type SingleProjectionColumn<C extends Record<string, unknown>> = keyof C extends infer A
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

type ParseOrScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseAndScalarUntyped<Tokens, Env> extends [infer R0 extends ParserMonad, infer E0, infer Env0 extends ExprParseEnv]
		? E0 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R0, E0, Env0>
			: E0 extends ScalarExprAst
				? ParseOrLoopScalarUntyped<R0, [E0], [], Env0>
				: never
		: never

type ResolveFunctionArgsList<
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	Acc extends readonly SqlTypeShape[] = [],
> = Args extends readonly [infer First, ...infer Rest extends readonly (ScalarExprAst | { kind: "star" })[]]
	? First extends { kind: "star" }
		? ResolveFunctionArgsList<Rest, Db, Scope, Params, readonly [...Acc, SqlUnknown]>
		: First extends ScalarExprAst
			? ResolveExpressionAST<First, Db, Scope, Params> extends infer Res
				? Res extends DbtyperErrorShape
					? Res
					: Res extends SqlTypeShape
						? ResolveFunctionArgsList<Rest, Db, Scope, Params, readonly [...Acc, Res]>
						: never
				: never
			: never
	: Acc

type ArgsTupleContainsStar<Args extends readonly (ScalarExprAst | { kind: "star" })[]> = Args extends readonly [
	infer Head,
	...infer Tail extends readonly (ScalarExprAst | { kind: "star" })[],
]
	? Head extends { kind: "star" }
		? true
		: ArgsTupleContainsStar<Tail>
	: false

/**
 * SQLT-44…SQLT-52, PGT-27…PGT-33, FN-19…FN-21: a call in a chain, typed from its row in the function catalog of the
 * dialect (`functionCatalog`, src/parser/function-catalog.ts): argument count, window rules, result type and
 * nullability are columns of the row. A name that is not in the catalog is FN-1 (with the other dialect's hint,
 * SQLT-52, PGT-34). `Windowed`: the call has an OVER clause.
 */
type ResolveCatalogFunctionCall<
	Name extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Windowed extends boolean,
	L extends string = Lowercase<Name>,
	C extends string = DialectFact<Db, "functionCatalog">,
> =
	IsCatalogFunction<C, L> extends true
		? ArgsTupleContainsStar<Args> extends true
			? L extends "count"
				? CatalogRowResult<C, CatalogRow<C, "count", 0>, []>
				: FormatError<Errors["STAR_IS_ONLY_ALLOWED_AS_COUNT_STAR_ARGUMENT"], []>
			: ResolveFunctionArgsList<Args, Db, Scope, Params> extends infer ArgsRes
				? ArgsRes extends DbtyperErrorShape
					? ArgsRes
					: ArgsRes extends readonly SqlTypeShape[]
						? CatalogRow<C, L, ArgsRes["length"]> extends infer Row
							? CatalogArityError<Row, ArgsRes> extends infer Arity
								? Arity extends DbtyperErrorShape
									? Arity
									: EnumPeerCheck<Db, L, ArgsRes, Args> extends infer Peer extends DbtyperErrorShape
										? Peer
										: Windowed extends false
											? IsWindowOnlyRow<Row> extends true
												? FormatError<Errors["WINDOW_FUNCTION_REQUIRES_OVER_CLAUSE"], [Name]>
												: CatalogRowResult<C, Row, ArgsRes>
											: IsWindowCapableRow<Row> extends true
												? CatalogRowResult<C, Row, ArgsRes>
												: UnknownFunction<C, Name, L>
								: never
							: never
						: never
				: never
		: UnknownFunction<C, Name, L>

type PgHint<Hint extends string> = Hint extends "" ? "" : `; ${Hint}`

/** FN-1; SQLT-52, PGT-34: a name of the other dialect's catalog names its replacement. */
type UnknownFunction<C extends string, Name extends string, L extends string> = L extends keyof OtherDialectHints<C>
	? OtherDialectHints<C>[L] extends infer Hint extends string
		? FormatError<
				Errors["UNKNOWN_FUNCTION"],
				[Hint extends "" ? Name : `${Name}. ${Name}() is ${OtherDialectTitle<C>}-only${PgHint<Hint>}`]
			>
		: never
	: FormatError<Errors["UNKNOWN_FUNCTION"], [Name]>

/** CORE-2, CORE-3: nullability of a function call on top of its base result type. */
type ResolveFunctionCall<
	Name extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	L extends string = Lowercase<Name>,
> = ResolveCatalogFunctionCall<Name, Args, Db, Scope, Params, false, L>

type ResolveWindowFunction<
	Name extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	L extends string = Lowercase<Name>,
> = ResolveCatalogFunctionCall<Name, Args, Db, Scope, Params, true, L>

type ResolveCustomOp<
	Op extends string,
	L extends ScalarExprAst,
	R extends ScalarExprAst,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<L, Db, Scope, Params> extends infer Lv
		? Lv extends DbtyperErrorShape
			? Lv
			: ResolveExpressionAST<R, Db, Scope, Params> extends infer Rv
				? Rv extends DbtyperErrorShape
					? Rv
					: Lv extends SqlTypeShape
						? Rv extends SqlTypeShape
							? DialectFact<Db, "operators"> extends "sqlite"
								? Op extends keyof SqliteOperators
									? SqliteRowResult<SqliteOperators[Op], [Lv, Rv]>
									: ResolveBuiltinCustomOp<Op, Lv, Rv>
								: ResolveBuiltinCustomOp<Op, Lv, Rv>
							: never
						: never
				: never
		: never

type PgJsonTypes = "json" | "jsonb"

type ResolveBuiltinCustomOp<Op extends string, Lv extends SqlTypeShape, Rv extends SqlTypeShape> = Op extends
	| "->"
	| "#>"
	? Lv["type"] extends PgJsonTypes
		? Nullable<{ type: Lv["type"]; arg: null; nullable: false }> // PGT-24: the operand's json type, NULL when the key is missing
		: SqlUnknown
	: Op extends "->>" | "#>>"
		? Nullable<SqlText> // PGT-24
		: Op extends "@>" | "<@" | "?" | "?|" | "?&"
			? Lv["type"] extends PgJsonTypes
				? PgNullableIfEither<Lv, Rv, SqlBoolean> // PGT-24: jsonb containment and key existence
				: Op extends "@>" | "<@"
					? SqlBoolean
					: SqlUnknown
			: Op extends "&&"
				? SqlBoolean
				: Op extends "||"
					? Lv["type"] extends "array"
						? Rv["type"] extends "text"
							? FormatError<Errors["CANNOT_CONCATENATE_ARRAY_WITH_TEXT"], []>
							: Rv["type"] extends "array"
								? Lv
								: Lv
						: Rv["type"] extends "array"
							? Lv["type"] extends "text"
								? FormatError<Errors["CANNOT_CONCATENATE_TEXT_WITH_ARRAY"], []>
								: Rv
							: Lv["type"] extends "text"
								? Rv["type"] extends "text" | "integer" | "bigint" | "numeric" | "uuid" | "boolean"
									? SqlText
									: FormatError<Errors["CANNOT_CONCATENATE_TEXT_WITH_TYPE"], [Rv["type"]]>
								: Rv["type"] extends "text"
									? Lv["type"] extends "integer" | "bigint" | "numeric" | "uuid" | "boolean"
										? SqlText
										: FormatError<Errors["CANNOT_CONCATENATE_TYPE_WITH_TEXT"], [Lv["type"]]>
									: FormatError<Errors["CONCAT_REQUIRES_AT_LEAST_ONE_TEXT_OPERAND"], []>
					: SqlUnknown

type ResolveArrayCtorElements<
	Els extends readonly ScalarExprAst[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	AccTypes extends readonly SqlTypeShape[] = readonly [],
> = Els extends readonly [infer H extends ScalarExprAst, ...infer R extends readonly ScalarExprAst[]]
	? ResolveExpressionAST<H, Db, Scope, Params> extends infer V
		? V extends DbtyperErrorShape
			? V
			: V extends SqlTypeShape
				? ResolveArrayCtorElements<R, Db, Scope, Params, readonly [...AccTypes, V]>
				: never
		: never
	: InferArrayType<AccTypes>

type InferArrayType<Types extends readonly SqlTypeShape[]> = Types extends readonly []
	? FormatError<Errors["CANNOT_DETERMINE_TYPE_OF_EMPTY_ARRAY"], []>
	: Types extends readonly [infer First extends SqlTypeShape, ...infer Rest extends readonly SqlTypeShape[]]
		? UnifyArrayElementTypes<First, Rest> extends infer Unified extends SqlTypeShape
			? { type: "array"; arg: Unified; nullable: false }
			: never
		: never

type UnifyArrayElementTypes<First extends SqlTypeShape, Rest extends readonly SqlTypeShape[]> = Rest extends readonly []
	? First
	: Rest extends readonly [infer Next extends SqlTypeShape, ...infer Tail extends readonly SqlTypeShape[]]
		? SameComparisonClass<First, Next> extends true
			? UnifyArrayElementTypes<First, Tail>
			: SqlUnknown
		: never

// Parse expression to AST to be resolved later when `FROM` scope is known (`OR` … `AND` … `NOT` … comparisons … arithmetic).

export type ParseExpressionAST<Tokens extends ParserMonad, Env extends ExprParseEnv> = ParseOrScalarUntyped<Tokens, Env>

/** Resolve after `FROM` scope is known */
type ExpressionResolvers<
	Ast,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> = {
	true: SqlBoolean
	false: SqlBoolean
	sql_null: SqlNull
	string: Ast extends { kind: "string"; value: string }
		? Ast extends { blob: true }
			? { type: "blob"; arg: null; nullable: false } // SQLT-29
			: SqlText
		: never
	number: Ast extends { kind: "number"; raw: infer Raw extends string } ? NumberLiteralType<Db, Raw> : never
	param: Ast extends { kind: "param"; name: infer N extends string } ? LookupParam<Params, N> : never
	"positional-param": Ast extends { kind: "positional-param"; index: infer I extends number }
		? LookupPositionalParam<Params, I>
		: never
	custom_op: Ast extends {
		kind: "custom_op"
		op: infer Op extends string
		left: infer L extends ScalarExprAst
		right: infer R extends ScalarExprAst
	}
		? ResolveCustomOp<Op, L, R, Db, Scope, Params>
		: never
	exp: Ast extends { kind: "exp"; left: infer L extends ScalarExprAst; right: infer R extends ScalarExprAst }
		? ResolveScalarExprAstPair<L, R, Db, Scope, Params>
		: never
	mod: Ast extends { kind: "mod"; left: infer L extends ScalarExprAst; right: infer R extends ScalarExprAst }
		? ResolveScalarExprAstPair<L, R, Db, Scope, Params>
		: never
	function_call: Ast extends {
		kind: "function_call"
		name: infer FnName extends string
		args: infer FArgs extends readonly (ScalarExprAst | { kind: "star" })[]
	}
		? ResolveFunctionCall<FnName, FArgs, Db, Scope, Params>
		: never
	window_function: Ast extends {
		kind: "window_function"
		name: infer FnName extends string
		args: infer FArgs extends readonly (ScalarExprAst | { kind: "star" })[]
		over: infer _Over
	}
		? ResolveWindowFunction<FnName, FArgs, Db, Scope, Params>
		: never
	qualified_table_star: FormatError<Errors["QUALIFIED_TABLE_STAR_IS_ONLY_VALID_IN_SELECT_LISTS"], []>
	alias_table_star: FormatError<Errors["QUALIFIED_TABLE_STAR_IS_ONLY_VALID_IN_SELECT_LISTS"], []>
	array_ctor: Ast extends {
		kind: "array_ctor"
		elements: infer Els extends readonly ScalarExprAst[]
	}
		? ResolveArrayCtorElements<Els, Db, Scope, Params>
		: never
	array_index: Ast extends {
		kind: "array_index"
		base: infer B extends ScalarExprAst
		index: infer I extends ScalarExprAst
	}
		? ResolveExpressionAST<B, Db, Scope, Params> extends infer Lv
			? Lv extends DbtyperErrorShape
				? Lv
				: ResolveExpressionAST<I, Db, Scope, Params> extends infer Rv
					? Rv extends DbtyperErrorShape
						? Rv
						: Lv extends SqlTypeShape
							? Rv extends SqlTypeShape
								? SqlUnknown
								: never
							: never
					: never
			: never
		: never
	col: Ast extends { kind: "col"; parts: infer P extends ScalarIdentParts }
		? ResolveIdentChainValue<Db, Scope, P>
		: never
	neg: Ast extends { kind: "neg"; inner: infer I extends ScalarExprAst }
		? ResolveScalarExprAstNeg<I, Db, Scope, Params>
		: never
	mul: Ast extends {
		kind: "mul"
		left: infer L extends ScalarExprAst
		right: infer R extends ScalarExprAst
	}
		? ResolveScalarExprAstPair<L, R, Db, Scope, Params>
		: never
	add: Ast extends {
		kind: "add"
		left: infer La extends ScalarExprAst
		right: infer Ra extends ScalarExprAst
	}
		? ResolveScalarExprAstPair<La, Ra, Db, Scope, Params, "add">
		: never
	sub: Ast extends {
		kind: "sub"
		left: infer Ls extends ScalarExprAst
		right: infer Rs extends ScalarExprAst
	}
		? ResolveScalarExprAstPair<Ls, Rs, Db, Scope, Params, "sub">
		: never
	not: Ast extends { kind: "not"; inner: infer I extends ScalarExprAst }
		? ResolveExpressionAST<I, Db, Scope, Params> extends infer V
			? MergeBoolNot<V>
			: never
		: never
	and: Ast extends { kind: "and"; left: infer La extends ScalarExprAst; right: infer Ra extends ScalarExprAst }
		? ResolveExpressionAST<La, Db, Scope, Params> extends infer Lv
			? ResolveExpressionAST<Ra, Db, Scope, Params> extends infer Rv
				? MergeBoolBinary<Lv, Rv, "AND_OPERANDS_MUST_BE_BOOLEAN">
				: never
			: never
		: never
	or: Ast extends { kind: "or"; left: infer Lo extends ScalarExprAst; right: infer Ro extends ScalarExprAst }
		? ResolveExpressionAST<Lo, Db, Scope, Params> extends infer Lv2
			? ResolveExpressionAST<Ro, Db, Scope, Params> extends infer Rv2
				? MergeBoolBinary<Lv2, Rv2, "OR_OPERANDS_MUST_BE_BOOLEAN">
				: never
			: never
		: never
	cmp: Ast extends {
		kind: "cmp"
		op: infer _Op extends ScalarCmpOp
		left: infer Lc extends ScalarExprAst
		right: infer Rc extends ScalarExprAst
	}
		? ResolveExpressionAST<Lc, Db, Scope, Params> extends infer LcV
			? ResolveExpressionAST<Rc, Db, Scope, Params> extends infer RcV
				? LcV extends DbtyperErrorShape
					? LcV
					: RcV extends DbtyperErrorShape
						? RcV
						: LcV extends SqlTypeShape
							? RcV extends SqlTypeShape
								? WithEnumCheck<
										EnumComparisonCheck<Db, LcV, Lc, RcV, Rc>,
										MergeComparison<LcV, RcV, Lc, Rc>
									>
								: never
							: never
				: never
			: never
		: never
	is_cmp: Ast extends { kind: "is_cmp"; left: infer Li extends ScalarExprAst; right: infer Ri extends ScalarExprAst }
		? ResolveExpressionAST<Li, Db, Scope, Params> extends infer LiV
			? LiV extends DbtyperErrorShape
				? LiV
				: ResolveExpressionAST<Ri, Db, Scope, Params> extends infer RiV
					? RiV extends DbtyperErrorShape
						? RiV
						: SqlBoolean
					: never
			: never
		: never
	is_null: Ast extends { kind: "is_null"; expr: infer E0 extends ScalarExprAst }
		? ResolveExpressionAST<E0, Db, Scope, Params> extends infer V0
			? V0 extends DbtyperErrorShape
				? V0
				: V0 extends SqlTypeShape
					? SqlBoolean
					: never
			: never
		: never
	is_not_null: Ast extends { kind: "is_not_null"; expr: infer E1 extends ScalarExprAst }
		? ResolveExpressionAST<E1, Db, Scope, Params> extends infer V1
			? V1 extends DbtyperErrorShape
				? V1
				: V1 extends SqlTypeShape
					? SqlBoolean
					: never
			: never
		: never
	pg_cast: Ast extends {
		kind: "pg_cast"
		expr: infer Exc extends ScalarExprAst
		type_parts: infer Ptc extends readonly string[]
	}
		? ResolveExpressionAST<Exc, Db, Scope, Params> extends infer Evc
			? Evc extends DbtyperErrorShape
				? Evc
				: Evc extends SqlTypeShape
					? SqlCastTypeNorm<Ptc> extends infer Normc extends string
						? WithCastLabelCheck<Db, ResolveCastForDialect<Db, Evc, Normc>, Exc>
						: never
					: never
			: never
		: never
	sql_cast: Ast extends {
		kind: "sql_cast"
		expr: infer Exs extends ScalarExprAst
		type_parts: infer Pts extends readonly string[]
	}
		? ResolveExpressionAST<Exs, Db, Scope, Params> extends infer Evs
			? Evs extends DbtyperErrorShape
				? Evs
				: Evs extends SqlTypeShape
					? SqlCastTypeNorm<Pts> extends infer Norms extends string
						? WithCastLabelCheck<Db, ResolveCastForDialect<Db, Evs, Norms>, Exs>
						: never
					: never
			: never
		: never
	between: Ast extends {
		kind: "between"
		expr: infer Eb extends ScalarExprAst
		low: infer Lb extends ScalarExprAst
		high: infer Hb extends ScalarExprAst
	}
		? ResolveExpressionAST<Eb, Db, Scope, Params> extends infer EvB
			? EvB extends DbtyperErrorShape
				? EvB
				: ResolveExpressionAST<Lb, Db, Scope, Params> extends infer LvB
					? LvB extends DbtyperErrorShape
						? LvB
						: ResolveExpressionAST<Hb, Db, Scope, Params> extends infer HvB
							? HvB extends DbtyperErrorShape
								? HvB
								: EvB extends SqlTypeShape
									? LvB extends SqlTypeShape
										? HvB extends SqlTypeShape
											? WithEnumCheck<
													EnumBetweenCheck<Db, EvB, Eb, LvB, Lb, HvB, Hb>,
													MergeBetweenBounds<EvB, LvB, HvB, Eb, Lb, Hb>
												>
											: never
										: never
									: never
							: never
					: never
			: never
		: never
	like: Ast extends {
		kind: "like"
		expr: infer Exl extends ScalarExprAst
		pattern: infer Pl extends ScalarExprAst
		case_insensitive: infer _CI extends boolean
	}
		? ResolveExpressionAST<Exl, Db, Scope, Params> extends infer EvL
			? EvL extends DbtyperErrorShape
				? EvL
				: ResolveExpressionAST<Pl, Db, Scope, Params> extends infer PvL
					? PvL extends DbtyperErrorShape
						? PvL
						: EvL extends SqlTypeShape
							? PvL extends SqlTypeShape
								? MergeLikeOperands<EvL, PvL>
								: never
							: never
					: never
			: never
		: never
	pg_regex_match: Ast extends {
		kind: "pg_regex_match"
		expr: infer Exr extends ScalarExprAst
		pattern: infer Pr extends ScalarExprAst
		case_insensitive: infer _CR extends boolean
	}
		? ResolveExpressionAST<Exr, Db, Scope, Params> extends infer EvR
			? EvR extends DbtyperErrorShape
				? EvR
				: ResolveExpressionAST<Pr, Db, Scope, Params> extends infer PvR
					? PvR extends DbtyperErrorShape
						? PvR
						: EvR extends SqlTypeShape
							? PvR extends SqlTypeShape
								? MergeLikeOperands<EvR, PvR>
								: never
							: never
					: never
			: never
		: never
	case_simple: Ast extends {
		kind: "case_simple"
		discriminant: infer Dsc extends ScalarExprAst
		arms: infer ArmsS extends readonly {
			when: ScalarExprAst
			then: ScalarExprAst
		}[]
		else_: infer ElS extends ScalarExprAst | null
	}
		? ResolveCaseSimple<Dsc, ArmsS, ElS, Db, Scope, Params>
		: never
	case_searched: Ast extends {
		kind: "case_searched"
		arms: infer Arms extends readonly {
			when: ScalarExprAst
			then: ScalarExprAst
		}[]
		else_: infer Elc extends ScalarExprAst | null
	}
		? ResolveCaseSearched<Arms, Elc, Db, Scope, Params>
		: never
	exists_subquery: Ast extends {
		kind: "exists_subquery"
		sub: infer _Ex extends JsqlSelectStatementResult
	}
		? SqlBoolean
		: never
	scalar_subquery: Ast extends {
		kind: "scalar_subquery"
		sel: infer Sel extends JsqlSelectStatementResult
	}
		? ResolveScalarSubquerySel<Sel>
		: never
	in_subquery: Ast extends {
		kind: "in_subquery"
		expr: infer Ie extends ScalarExprAst
		sub: infer Isub extends JsqlSelectStatementResult
	}
		? ResolveInSubqueryAst<Ie, Isub, Db, Scope, Params>
		: never
	any_op: Ast extends {
		kind: "any_op"
		op: infer Op extends string
		left: infer L extends ScalarExprAst
		right: infer R extends ScalarExprAst | JsqlSelectStatementResult
	}
		? ResolveAnyAllSomeOp<Op, L, R, Db, Scope, Params>
		: never
	all_op: Ast extends {
		kind: "all_op"
		op: infer Op extends string
		left: infer L extends ScalarExprAst
		right: infer R extends ScalarExprAst | JsqlSelectStatementResult
	}
		? ResolveAnyAllSomeOp<Op, L, R, Db, Scope, Params>
		: never
	some_op: Ast extends {
		kind: "some_op"
		op: infer Op extends string
		left: infer L extends ScalarExprAst
		right: infer R extends ScalarExprAst | JsqlSelectStatementResult
	}
		? ResolveAnyAllSomeOp<Op, L, R, Db, Scope, Params>
		: never
	in_list: Ast extends {
		kind: "in_list"
		expr: infer Eln extends ScalarExprAst
		items: infer Ins extends readonly ScalarExprAst[]
	}
		? ResolveExpressionAST<Eln, Db, Scope, Params> extends infer LvIn
			? LvIn extends DbtyperErrorShape
				? LvIn
				: LvIn extends SqlTypeShape
					? ResolveInListItemsAgainstLeft<LvIn, Eln, Ins, Db, Scope, Params>
					: never
			: never
		: never
}

export type ResolveExpressionAST<
	Ast,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Ast extends { kind: infer K extends keyof ExpressionResolvers<any, any, any, any> }
	? ParamProbeAt<Ast, Db, Scope, Params> extends infer Probed
		? [Probed] extends [never]
			? ApplyOperandNullability<Ast, ExpressionResolvers<Ast, Db, Scope, Params>[K], Db, Scope, Params>
			: Probed
		: never
	: never

/** Operands of an operator that must have one type, and whether that type has to be numeric. */
type SharedTypeOperands<Ast> = Ast extends {
	kind: "add" | "sub" | "mul" | "exp" | "mod"
	left: infer L extends ScalarExprAst
	right: infer R extends ScalarExprAst
}
	? { ops: readonly [L, R]; numeric: true }
	: Ast extends { kind: "cmp" | "is_cmp"; left: infer L extends ScalarExprAst; right: infer R extends ScalarExprAst }
		? { ops: readonly [L, R]; numeric: false }
		: Ast extends {
					kind: "like" | "pg_regex_match"
					expr: infer E extends ScalarExprAst
					pattern: infer P extends ScalarExprAst
			  }
			? { ops: readonly [E, P]; numeric: false }
			: Ast extends {
						kind: "between"
						expr: infer E extends ScalarExprAst
						low: infer Lo extends ScalarExprAst
						high: infer Hi extends ScalarExprAst
				  }
				? { ops: readonly [E, Lo, Hi]; numeric: false }
				: Ast extends {
							kind: "in_list"
							expr: infer E extends ScalarExprAst
							items: infer Its extends readonly ScalarExprAst[]
					  }
					? { ops: readonly [E, ...Its]; numeric: false }
					: never

/** The probe key of a parameter operand that has no type yet, `never` for anything else. */
type ParamOperandProbeKey<Op, Params extends ExpressionParamsShape> = Op extends {
	kind: "param"
	name: infer N extends string
}
	? ProbeKeyOf<LookupParam<Params, N>>
	: Op extends { kind: "positional-param"; index: infer I extends number }
		? ProbeKeyOf<LookupPositionalParam<Params, I>>
		: never

type ParamDisplay<K extends string | number> = K extends number ? `$${Inc<K>}` : `:${K & string}`

type AllParamOperands<Ops extends readonly unknown[]> = Ops extends readonly [infer H, ...infer T]
	? IsParamOperand<H> extends true
		? AllParamOperands<T>
		: false
	: true

type IsParamOperand<Op> = Op extends { kind: "param" | "positional-param" } ? true : false

/** The type of the first operand that is not a parameter, resolves to a real type (and a numeric one if asked). */
type PeerOperandType<
	Ops extends readonly unknown[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Numeric extends boolean,
> = Ops extends readonly [infer H, ...infer T]
	? IsParamOperand<H> extends true
		? PeerOperandType<T, Db, Scope, Params, Numeric>
		: H extends ScalarExprAst
			? ResolveExpressionAST<H, Db, Scope, Params> extends infer R
				? R extends SqlTypeShape
					? R["type"] extends "null" | "param-probe"
						? PeerOperandType<T, Db, Scope, Params, Numeric>
						: Numeric extends true
							? R["type"] extends
									| "integer"
									| "bigint"
									| "smallint"
									| "numeric"
									| "real"
									| "double precision"
								? R
								: PeerOperandType<T, Db, Scope, Params, Numeric>
							: R
					: PeerOperandType<T, Db, Scope, Params, Numeric>
				: never
			: PeerOperandType<T, Db, Scope, Params, Numeric>
	: never

type ProbeFromPeers<
	Key,
	Ops extends readonly unknown[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Numeric extends boolean,
> = Key extends string | number
	? [PeerOperandType<Ops, Db, Scope, Params, Numeric>] extends [never]
		? // CORE-7: only parameters meet, nothing gives them a type
			AllParamOperands<Ops> extends true
			? FormatError<Errors["CANNOT_INFER_PARAMETER_TYPE"], [ParamDisplay<Key>, ParamDisplay<Key>]>
			: never
		: PeerOperandType<Ops, Db, Scope, Params, Numeric> extends infer S extends SqlTypeShape
			? ParamProbeFound<Key, ProbeTypeFromPeer<S>>
			: never
	: never

/** The first argument that is a parameter without a type, resolved by the function's argument types. */
type ProbeInFunctionArgs<
	Name extends string,
	Args extends readonly unknown[],
	AllArgs extends readonly unknown[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Index extends number = 0,
> = Args extends readonly [infer H, ...infer T]
	? ParamOperandProbeKey<H, Params> extends infer K
		? [K] extends [never]
			? ProbeInFunctionArgs<Name, T, AllArgs, Db, Scope, Params, Inc<Index>>
			: K extends string | number
				? CatalogRow<DialectFact<Db, "functionCatalog">, Name, AllArgs["length"]> extends infer Row
					? IsPeerTypedRow<Row> extends true
						? ProbeFromPeers<K, AllArgs, Db, Scope, Params, false>
						: [RowArgType<Row, Index>] extends [never]
							? never
							: ParamProbeFound<K, RowArgType<Row, Index>>
					: never
				: never
		: never
	: never

/**
 * CORE-6: a parameter that has no type yet (a probe, src/core/param-probe.ts) gets one from the operator, cast or
 * function it stands in; the result is the error that carries that type to the driver. `never` for everything else.
 */
type ParamProbeAt<Ast, Db extends JsqlDatabaseShape, Scope extends ScopeMap, Params extends ExpressionParamsShape> = [
	SharedTypeOperands<Ast>,
] extends [never]
	? Ast extends {
			kind: "pg_cast" | "sql_cast"
			expr: infer E
			type_parts: infer P extends readonly string[]
		}
		? ParamOperandProbeKey<E, Params> extends infer K
			? [K] extends [never]
				? never
				: K extends string | number
					? ResolveCastFromShape<SqlText, SqlCastTypeNorm<P>> extends infer S extends SqlTypeShape
						? ParamProbeFound<K, S>
						: never
					: never
			: never
		: Ast extends {
					kind: "function_call"
					name: infer Fn extends string
					args: infer A extends readonly unknown[]
			  }
			? ProbeInFunctionArgs<Lowercase<Fn>, A, A, Db, Scope, Params>
			: never
	: SharedTypeOperands<Ast> extends { ops: infer Ops extends readonly unknown[]; numeric: infer N extends boolean }
		? ProbeInOperands<Ops, Ops, Db, Scope, Params, N>
		: never

type ProbeInOperands<
	Rest extends readonly unknown[],
	Ops extends readonly unknown[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Numeric extends boolean,
> = Rest extends readonly [infer H, ...infer T]
	? ParamOperandProbeKey<H, Params> extends infer K
		? [K] extends [never]
			? ProbeInOperands<T, Ops, Db, Scope, Params, Numeric>
			: ProbeFromPeers<K, Ops, Db, Scope, Params, Numeric>
		: never
	: never

/** The operand expressions of an operator whose result is NULL when an operand is NULL (CORE-2). */
type NullPropagatingOperands<Ast> = Ast extends {
	kind: "add" | "sub" | "mul" | "exp" | "mod" | "custom_op" | "cmp" | "and" | "or"
	left: infer L extends ScalarExprAst
	right: infer R extends ScalarExprAst
}
	? readonly [L, R]
	: Ast extends { kind: "neg" | "not"; inner: infer I extends ScalarExprAst }
		? readonly [I]
		: Ast extends { kind: "pg_cast" | "sql_cast"; expr: infer E extends ScalarExprAst }
			? readonly [E]
			: Ast extends {
						kind: "between"
						expr: infer E extends ScalarExprAst
						low: infer Lo extends ScalarExprAst
						high: infer Hi extends ScalarExprAst
				  }
				? readonly [E, Lo, Hi]
				: Ast extends {
							kind: "like" | "pg_regex_match"
							expr: infer E extends ScalarExprAst
							pattern: infer P extends ScalarExprAst
					  }
					? readonly [E, P]
					: Ast extends {
								kind: "in_list"
								expr: infer E extends ScalarExprAst
								items: infer Its extends readonly ScalarExprAst[]
						  }
						? readonly [E, ...Its]
						: Ast extends {
									kind: "any_op" | "all_op" | "some_op"
									left: infer L extends ScalarExprAst
							  }
							? readonly [L]
							: readonly []

type AnyOperandNullable<
	Ops extends readonly ScalarExprAst[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> = Ops extends readonly [infer H extends ScalarExprAst, ...infer T extends readonly ScalarExprAst[]]
	? ResolveExpressionAST<H, Db, Scope, Params> extends { nullable: true }
		? true
		: AnyOperandNullable<T, Db, Scope, Params>
	: false

/** CORE-2: an operator result is nullable when any operand is. */
type ApplyOperandNullability<
	Ast,
	Res,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> = Res extends DbtyperErrorShape
	? Res
	: Res extends SqlTypeShape
		? Res["nullable"] extends true
			? Res
			: AnyOperandNullable<NullPropagatingOperands<Ast>, Db, Scope, Params> extends true
				? Nullable<Res>
				: Res
		: Res

/** Longest `a` / `a.b` / `a.b.c` chain starting at an identifier (used by SELECT list fast path).
 * Also recognizes `alias.*` and `schema.table.*` via sentinel tuples `["__ats__", alias]` / `["__qts__", sch, tab]`.
 */
type MaximalIdentChain<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends infer T1
		? AsIdent<T1> extends TokenIdent<infer A extends string>
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<".">
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? PeekToken<R2> extends TokenKey<"*">
							? SkipToken<R2> extends infer R3 extends ParserMonad
								? [R3, readonly ["__ats__", A], ""]
								: never
							: PeekToken<R2> extends infer T2
								? AsIdent<T2> extends TokenIdent<infer B extends string>
									? SkipToken<R2> extends infer R3 extends ParserMonad
										? PeekToken<R3> extends TokenKey<".">
											? SkipToken<R3> extends infer R4 extends ParserMonad
												? PeekToken<R4> extends TokenKey<"*">
													? SkipToken<R4> extends infer R5 extends ParserMonad
														? [R5, readonly ["__qts__", A, B], ""]
														: never
													: PeekToken<R4> extends infer T4
														? AsIdent<T4> extends TokenIdent<infer C extends string>
															? SkipToken<R4> extends infer R5 extends ParserMonad
																? [R5, readonly [A, B, C], WrittenOf<T4>]
																: never
															: never
														: never
												: never
											: [R3, readonly [A, B], WrittenOf<T2>]
										: never
									: never
								: never
						: never
					: [R1, readonly [A], WrittenOf<T1>]
				: never
			: never
		: never

/** SQLite (SQLT-28): how an identifier token was written in the query; "" when the token does not say. */
type WrittenOf<T> = T extends { written: infer W extends string } ? W : ""

type LookupParam<Params extends ExpressionParamsShape, Name extends string> = Name extends keyof Params
	? Params[Name]
	: FormatError<Errors["UNKNOWN_QUERY_PARAMETER"], [Name]>

type LookupPositionalParam<
	Params extends ExpressionParamsShape,
	Index extends number,
> = Params extends readonly SqlTypeShape[]
	? // PARAM-13: for a tuple (`["a"]`) an index beyond its length is out of bounds; a plain array has no known length
		number extends Params["length"]
		? Params[number]
		: `${Index}` extends keyof Params
			? Params[Index]
			: FormatError<Errors["POSITIONAL_PARAMETER_OUT_OF_BOUNDS"], [Index]>
	: FormatError<Errors["POSITIONAL_PARAMETER_REQUIRES_ARRAY"], []>

type ResolveIdentChainValue<
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Parts extends readonly [string] | readonly [string, string] | readonly [string, string, string],
> =
	ResolveColumnRefValue<Db, Scope, Parts> extends infer V
		? V extends DbtyperErrorShape
			? V
			: V extends { sql: infer Sql extends SqlTypeShape }
				? Sql
				: never
		: never

type ParseFunctionArgsAccum<
	Tokens extends ParserMonad,
	Env extends ExprParseEnv,
	Acc extends readonly (ScalarExprAst | { kind: "star" })[],
> =
	PeekToken<Tokens> extends TokenKey<")">
		? [SkipToken<Tokens>, Acc, Env]
		: ParseOrScalarUntyped<Tokens, Env> extends [
					infer R1 extends ParserMonad,
					infer E,
					infer Env1 extends ExprParseEnv,
			  ]
			? E extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<R1, E, Env1>
				: E extends ScalarExprAst
					? PeekToken<R1> extends TokenKey<")">
						? [SkipToken<R1>, readonly [...Acc, E], Env1]
						: PeekToken<R1> extends TokenKey<"," | "from" | "for"> | TokenIdent<"for"> // `substring(s from 1 for 2)`, `trim(x from y)`
							? ParseFunctionArgsAccum<SkipToken<R1>, Env1, readonly [...Acc, E]>
							: SkipFailedExpressionWithEnv<
									R1,
									FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ARGUMENT_LIST"], []>,
									Env1
								>
					: never
			: never

/**
 * The arguments of a call after `(`: the SQL forms `extract(<field> FROM <expr>)` (the field becomes a string
 * argument) and `position(<substring> IN <string>)` (PGT-28, PGT-30), else the plain list.
 */
export type ParseCallArgs<Tokens extends ParserMonad, Parts, Env extends ExprParseEnv> = Parts extends readonly [
	"extract",
]
	? AsIdent<PeekToken<Tokens>> extends TokenIdent<infer Field extends string>
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"from">
				? ParseCallArgsTail<SkipToken<R1>, Env, readonly [{ kind: "string"; value: Field }], "from">
				: SkipFailedExpressionWithEnv<R1, FormatError<Errors["UNEXPECTED_TOKEN"], ["EXTRACT"]>, Env>
			: never
		: SkipFailedExpressionWithEnv<Tokens, FormatError<Errors["UNEXPECTED_TOKEN"], ["EXTRACT"]>, Env>
	: Parts extends readonly ["position"]
		? ParseOtherOpScalarUntyped<Tokens, Env> extends [
				infer R1 extends ParserMonad,
				infer First,
				infer Env1 extends ExprParseEnv,
			]
			? First extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<R1, First, Env1>
				: First extends ScalarExprAst
					? PeekToken<R1> extends TokenKey<"in">
						? ParseCallArgsTail<SkipToken<R1>, Env1, readonly [First], "in">
						: PeekToken<R1> extends TokenKey<",">
							? ParseFunctionArgsAccum<SkipToken<R1>, Env1, readonly [First]>
							: SkipFailedExpressionWithEnv<
									R1,
									FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ARGUMENT_LIST"], []>,
									Env1
								>
					: never
			: never
		: Parts extends readonly ["trim"]
			? PeekToken<Tokens> extends TokenIdent<"both" | "leading" | "trailing"> // `trim(both 'x' from s)`
				? ParseFunctionArgs<SkipToken<Tokens>, Env>
				: ParseFunctionArgs<Tokens, Env>
			: ParseFunctionArgs<Tokens, Env>

/** One more expression and the closing `)` of a `FROM` / `IN` call form. */
type ParseCallArgsTail<
	Tokens extends ParserMonad,
	Env extends ExprParseEnv,
	Acc extends readonly ScalarExprAst[],
	_Kw extends string,
> =
	ParseOrScalarUntyped<Tokens, Env> extends [infer R1 extends ParserMonad, infer E, infer Env1 extends ExprParseEnv]
		? E extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R1, E, Env1>
			: E extends ScalarExprAst
				? PeekToken<R1> extends TokenKey<")">
					? [SkipToken<R1>, readonly [...Acc, E], Env1]
					: SkipFailedExpressionWithEnv<
							R1,
							FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ARGUMENT_LIST"], []>,
							Env1
						>
				: never
		: never

type ParseFunctionArgs<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"*">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<")">
				? [SkipToken<R1>, readonly [{ kind: "star" }], Env]
				: SkipFailedExpressionWithEnv<R1, FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_STAR"], []>, Env>
			: never
		: PeekToken<Tokens> extends TokenKey<")">
			? [SkipToken<Tokens>, readonly [], Env]
			: ParseFunctionArgsAccum<Tokens, Env, readonly []>

type ParseOptionalOverClause<
	Tokens extends ParserMonad,
	FnName extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Env extends ExprParseEnv,
> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<"filter">
		? ParseFilterClause<Tokens, Env> extends [
				infer RF extends ParserMonad,
				infer FErr,
				infer EnvF extends ExprParseEnv,
			]
			? FErr extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<RF, FErr, EnvF>
				: ParseOverAfterFilter<RF, FnName, Args, EnvF>
			: never
		: ParseOverAfterFilter<Tokens, FnName, Args, Env>

type ParseOverAfterFilter<
	Tokens extends ParserMonad,
	FnName extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"over">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"(">
				? ParseWindowClauseContent<SkipToken<R1>, FnName, Args, Env>
				: SkipFailedExpressionWithEnv<R1, FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_OVER"], []>, Env>
			: never
		: [Tokens, { kind: "function_call"; name: FnName; args: Args }, Env]

/**
 * SQLT-51: `FILTER (WHERE <expr>)` after an aggregate call. Returns `[rest, error or null, env]`. The condition is parsed; it does not change the result type.
 */
type ParseFilterClause<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	SkipToken<Tokens> extends infer R1 extends ParserMonad
		? PeekToken<R1> extends TokenKey<"(">
			? SkipToken<R1> extends infer R2 extends ParserMonad
				? PeekToken<R2> extends TokenKey<"where">
					? ParseOrScalarUntyped<SkipToken<R2>, Env> extends [
							infer R3 extends ParserMonad,
							infer Cond,
							infer Env3 extends ExprParseEnv,
						]
						? Cond extends DbtyperErrorShape
							? [R3, Cond, Env3]
							: PeekToken<R3> extends TokenKey<")">
								? [SkipToken<R3>, null, Env3]
								: [R3, FormatError<Errors["EXPECTED_CLOSE_PAREN"], []>, Env3]
						: never
					: [R2, FormatError<Errors["UNEXPECTED_TOKEN"], ["FILTER"]>, Env]
				: never
			: [R1, FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_OVER"], []>, Env]
		: never

type ParseWindowClauseContent<
	Tokens extends ParserMonad,
	FnName extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"partition">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"by">
				? ParseWindowPartitionByList<SkipToken<R1>, Env> extends [
						infer R2 extends ParserMonad,
						infer PartitionList,
						infer Env2 extends ExprParseEnv,
					]
					? PartitionList extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<R2, PartitionList, Env2>
						: PartitionList extends readonly ScalarExprAst[]
							? PeekToken<R2> extends TokenKey<"order">
								? ParseWindowOrderByAfterPartition<R2, FnName, Args, PartitionList, Env2>
								: PeekToken<R2> extends TokenKey<")">
									? [
											SkipToken<R2>,
											{
												kind: "window_function"
												name: FnName
												args: Args
												over: { partition_by: PartitionList; order_by: readonly [] }
											},
											Env2,
										]
									: CloseWindowOrError<
											R2,
											{
												kind: "window_function"
												name: FnName
												args: Args
												over: { partition_by: PartitionList; order_by: readonly [] }
											},
											Env2,
											FormatError<
												Errors["EXPECTED_ORDER_BY_OR_CLOSE_PAREN_AFTER_PARTITION_BY"],
												[]
											>
										>
							: never
					: never
				: SkipFailedExpressionWithEnv<R1, FormatError<Errors["EXPECTED_BY_AFTER_PARTITION"], []>, Env>
			: never
		: PeekToken<Tokens> extends TokenKey<"order">
			? ParseWindowOrderByWithoutPartition<Tokens, FnName, Args, Env>
			: CloseWindowOrError<
					Tokens,
					{ kind: "window_function"; name: FnName; args: Args; over: { order_by: readonly [] } },
					Env,
					FormatError<Errors["EXPECTED_PARTITION_BY_OR_ORDER_BY_IN_OVER_CLAUSE"], []>
				>

/**
 * SQLT-51: where the PostgreSQL window clause has an error, a chain whose dialect allows it (SQLite) accepts an empty
 * `OVER ()` and a frame (`ROWS|RANGE|GROUPS …`, skipped: it does not change a result type) before the closing paren.
 */
type CloseWindowOrError<Tokens extends ParserMonad, Ast, Env extends ExprParseEnv, Err extends DbtyperErrorShape> =
	DialectFact<Env["db"], "functionCatalog"> extends "sqlite"
		? PeekToken<Tokens> extends TokenKey<")">
			? [SkipToken<Tokens>, Ast, Env]
			: AsIdent<PeekToken<Tokens>> extends TokenIdent<"range" | "groups">
				? CloseWindowFrame<Tokens, Ast, Env, Err>
				: PeekToken<Tokens> extends TokenKey<"rows">
					? CloseWindowFrame<Tokens, Ast, Env, Err>
					: SkipFailedExpressionWithEnv<Tokens, Err, Env>
		: SkipFailedExpressionWithEnv<Tokens, Err, Env>

type CloseWindowFrame<Tokens extends ParserMonad, Ast, Env extends ExprParseEnv, Err extends DbtyperErrorShape> =
	SkipToCloseParen<Tokens> extends [infer Rf extends ParserMonad, unknown]
		? PeekToken<Rf> extends TokenKey<")">
			? [SkipToken<Rf>, Ast, Env]
			: SkipFailedExpressionWithEnv<Rf, Err, Env>
		: never

type SkipToCloseParen<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<")"> | TokenEot
		? [Tokens, null]
		: SkipToken<Tokens> extends infer Next extends ParserMonad
			? SkipToCloseParen<Next>
			: never

type ParseWindowOrderByWithoutPartition<
	Tokens extends ParserMonad,
	FnName extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Env extends ExprParseEnv,
> =
	SkipToken<Tokens> extends infer R3 extends ParserMonad
		? PeekToken<R3> extends TokenKey<"by">
			? ParseWindowOrderByList<SkipToken<R3>, Env> extends [
					infer R4 extends ParserMonad,
					infer OrderList,
					infer Env4 extends ExprParseEnv,
				]
				? OrderList extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R4, OrderList, Env4>
					: OrderList extends readonly { expr: ScalarExprAst; direction: "asc" | "desc" | null }[]
						? PeekToken<R4> extends TokenKey<")">
							? [
									SkipToken<R4>,
									{
										kind: "window_function"
										name: FnName
										args: Args
										over: { order_by: OrderList }
									},
									Env4,
								]
							: CloseWindowOrError<
									R4,
									{
										kind: "window_function"
										name: FnName
										args: Args
										over: { order_by: OrderList }
									},
									Env4,
									FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_OVER_CLAUSE"], []>
								>
						: never
				: never
			: SkipFailedExpressionWithEnv<R3, FormatError<Errors["EXPECTED_BY_AFTER_ORDER_IN_OVER_CLAUSE"], []>, Env>
		: never

type ParseWindowOrderByAfterPartition<
	Tokens extends ParserMonad,
	FnName extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	PartitionList extends readonly ScalarExprAst[],
	Env extends ExprParseEnv,
> =
	SkipToken<Tokens> extends infer R3 extends ParserMonad
		? PeekToken<R3> extends TokenKey<"by">
			? ParseWindowOrderByList<SkipToken<R3>, Env> extends [
					infer R4 extends ParserMonad,
					infer OrderList,
					infer Env4 extends ExprParseEnv,
				]
				? OrderList extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R4, OrderList, Env4>
					: OrderList extends readonly { expr: ScalarExprAst; direction: "asc" | "desc" | null }[]
						? PeekToken<R4> extends TokenKey<")">
							? [
									SkipToken<R4>,
									{
										kind: "window_function"
										name: FnName
										args: Args
										over: { partition_by: PartitionList; order_by: OrderList }
									},
									Env4,
								]
							: CloseWindowOrError<
									R4,
									{
										kind: "window_function"
										name: FnName
										args: Args
										over: { partition_by: PartitionList; order_by: OrderList }
									},
									Env4,
									FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_OVER_CLAUSE"], []>
								>
						: never
				: never
			: SkipFailedExpressionWithEnv<R3, FormatError<Errors["EXPECTED_BY_AFTER_ORDER"], []>, Env>
		: never

type ParseWindowPartitionByList<
	Tokens extends ParserMonad,
	Env extends ExprParseEnv,
	Acc extends readonly ScalarExprAst[] = readonly [],
> =
	ParseOrScalarUntyped<Tokens, Env> extends [
		infer R1 extends ParserMonad,
		infer Expr,
		infer Env1 extends ExprParseEnv,
	]
		? Expr extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R1, Expr, Env1>
			: Expr extends ScalarExprAst
				? PeekToken<R1> extends TokenKey<",">
					? ParseWindowPartitionByList<SkipToken<R1>, Env1, readonly [...Acc, Expr]>
					: [R1, readonly [...Acc, Expr], Env1]
				: never
		: never

type ParseWindowOrderByList<
	Tokens extends ParserMonad,
	Env extends ExprParseEnv,
	Acc extends readonly { expr: ScalarExprAst; direction: "asc" | "desc" | null }[] = readonly [],
> =
	ParseOrScalarUntyped<Tokens, Env> extends [
		infer R1 extends ParserMonad,
		infer Expr,
		infer Env1 extends ExprParseEnv,
	]
		? Expr extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R1, Expr, Env1>
			: Expr extends ScalarExprAst
				? PeekToken<R1> extends TokenKey<"asc">
					? ParseWindowOrderByListTail<
							SkipToken<R1>,
							Env1,
							readonly [...Acc, { expr: Expr; direction: "asc" }]
						>
					: PeekToken<R1> extends TokenKey<"desc">
						? ParseWindowOrderByListTail<
								SkipToken<R1>,
								Env1,
								readonly [...Acc, { expr: Expr; direction: "desc" }]
							>
						: ParseWindowOrderByListTail<R1, Env1, readonly [...Acc, { expr: Expr; direction: null }]>
				: never
		: never

type ParseWindowOrderByListTail<
	Tokens extends ParserMonad,
	Env extends ExprParseEnv,
	Acc extends readonly { expr: ScalarExprAst; direction: "asc" | "desc" | null }[],
> = PeekToken<Tokens> extends TokenKey<","> ? ParseWindowOrderByList<SkipToken<Tokens>, Env, Acc> : [Tokens, Acc, Env]

type IsSqlNumericType<Sql extends string | SqlTypeShape> = Sql extends SqlTypeShape
	? SqlComparisonClass<Sql["type"]> extends "numeric"
		? true
		: false
	: Sql extends string
		? SqlComparisonClass<Sql> extends "numeric"
			? true
			: false
		: false

type IsSqlBooleanType<Sql extends string | SqlTypeShape> = Sql extends SqlTypeShape
	? SqlComparisonClass<Sql["type"]> extends "boolean"
		? true
		: false
	: Sql extends string
		? SqlComparisonClass<Sql> extends "boolean"
			? true
			: false
		: false

type IsSqlTextType<Sql extends string | SqlTypeShape> = Sql extends SqlTypeShape
	? SqlComparisonClass<Sql["type"]> extends "text"
		? true
		: false
	: Sql extends string
		? SqlComparisonClass<Sql> extends "text"
			? true
			: false
		: false

/** PGT-16: `Ast` is an untyped string literal and `Other` is of a class that takes one without a cast. */
type StringLiteralFits<Ast, Other extends SqlTypeShape> = [Ast] extends [never]
	? false
	: Ast extends { kind: "string"; blob: true }
		? false
		: Ast extends { kind: "string" }
			? ShapeComparisonClass<Other> extends StringLiteralClasses
				? true
				: false
			: false

/**
 * EXPR-26: two operands are compatible when their classes are equal or either is "unknown", or one is an untyped
 * string literal (its AST, when the caller has it) and the other a class that takes one (PGT-16).
 */
export type SameComparisonClass<
	SqlL extends string | SqlTypeShape,
	SqlR extends string | SqlTypeShape,
	AstL = never,
	AstR = never,
> = SqlL extends SqlTypeShape
	? SqlR extends SqlTypeShape
		? ShapeComparisonClass<SqlL> extends "unknown"
			? true
			: ShapeComparisonClass<SqlR> extends "unknown"
				? true
				: ShapeComparisonClass<SqlL> extends ShapeComparisonClass<SqlR>
					? true
					: StringLiteralFits<AstL, SqlR> extends true
						? true
						: StringLiteralFits<AstR, SqlL>
		: false
	: SqlR extends SqlTypeShape
		? false
		: SqlL extends string
			? SqlR extends string
				? SqlComparisonClass<SqlL> extends "unknown"
					? true
					: SqlComparisonClass<SqlR> extends "unknown"
						? true
						: SqlComparisonClass<SqlL> extends SqlComparisonClass<SqlR>
							? true
							: false
				: false
			: false

type MergeComparison<
	L extends SqlTypeShape,
	R extends SqlTypeShape,
	LAst = never,
	RAst = never,
> = L["type"] extends "null"
	? FormatError<Errors["USE_IS_NULL_INSTEAD_OF_EQUALS_NULL"], []>
	: R["type"] extends "null"
		? FormatError<Errors["USE_IS_NULL_INSTEAD_OF_EQUALS_NULL"], []>
		: SameComparisonClass<L, R, LAst, RAst> extends true
			? SqlBoolean
			: FormatError<Errors["INCOMPATIBLE_TYPES_IN_COMPARISON"], []>

/** Simple `CASE expr WHEN value` — each `value` must be `=`-compatible with `expr` (same errors as comparisons). */
type ValidateCaseSimpleWhenMatch<
	Disc extends SqlTypeShape,
	WhenV extends SqlTypeShape,
	DiscAst = never,
	WhenAst = never,
> = MergeComparison<Disc, WhenV, DiscAst, WhenAst> extends infer M extends DbtyperErrorShape ? M : true

type MergeBetweenBounds<
	E extends SqlTypeShape,
	Lm extends SqlTypeShape,
	H extends SqlTypeShape,
	EAst = never,
	LmAst = never,
	HAst = never,
> = E["type"] extends "null"
	? FormatError<Errors["NULL_NOT_ALLOWED_IN_BETWEEN"], []>
	: Lm["type"] extends "null"
		? FormatError<Errors["NULL_NOT_ALLOWED_IN_BETWEEN"], []>
		: H["type"] extends "null"
			? FormatError<Errors["NULL_NOT_ALLOWED_IN_BETWEEN"], []>
			: SameComparisonClass<E, Lm, EAst, LmAst> extends true
				? SameComparisonClass<E, H, EAst, HAst> extends true
					? SqlBoolean
					: FormatError<Errors["INCOMPATIBLE_TYPES_IN_BETWEEN"], []>
				: FormatError<Errors["INCOMPATIBLE_TYPES_IN_BETWEEN"], []>

type MergeLikeOperands<Expr extends SqlTypeShape, Pat extends SqlTypeShape> = Expr["type"] extends "null"
	? FormatError<Errors["NULL_NOT_ALLOWED_IN_LIKE"], []>
	: Pat["type"] extends "null"
		? FormatError<Errors["NULL_NOT_ALLOWED_IN_LIKE"], []>
		: IsSqlTextType<Expr> extends true
			? IsSqlTextType<Pat> extends true
				? SqlBoolean
				: FormatError<Errors["LIKE_PATTERN_MUST_BE_TEXT"], []>
			: FormatError<Errors["LIKE_LEFT_OPERAND_MUST_BE_TEXT"], []>

/** CORE-2, CORE-5: a CASE result is nullable when any branch is (a NULL literal branch included). */
/** The AST of the branch whose type the CASE has so far: the first one that is not a NULL literal (EXPR-20). */
type NextCaseAccAst<Acc extends SqlTypeShape | null, AccAst, TvAst> = Acc extends SqlTypeShape
	? Acc["type"] extends "null"
		? TvAst
		: AccAst
	: TvAst

type MergeCaseThenAccum<
	Acc extends SqlTypeShape | null,
	Tv extends SqlTypeShape,
	AccAst = never,
	TvAst = never,
> = Acc extends null
	? Tv
	: Acc extends SqlTypeShape
		? Acc["type"] extends "null"
			? Tv["type"] extends "null"
				? SqlNull
				: Nullable<Tv>
			: Tv["type"] extends "null"
				? Nullable<Acc>
				: SameComparisonClass<Acc, Tv, AccAst, TvAst> extends true
					? Tv["nullable"] extends true
						? Nullable<Acc>
						: Acc
					: FormatError<Errors["INCOMPATIBLE_TYPES_IN_CASE"], []>
		: never

type ApplyCaseMissingElseNullability<E extends SqlTypeShape, MissingElse extends boolean> = MissingElse extends true
	? { type: E["type"]; arg: E["arg"]; nullable: true }
	: E

type ResolveCaseSearchedArms<
	Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	ElseB extends ScalarExprAst | null,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Acc extends SqlTypeShape | null,
	AccAst,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Arms extends readonly [
	infer A extends { when: ScalarExprAst; then: ScalarExprAst },
	...infer Rest extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
]
	? ResolveExpressionAST<A["when"], Db, Scope, Params> extends infer Wv
		? Wv extends DbtyperErrorShape
			? Wv
			: Wv extends SqlTypeShape
				? IsSqlBooleanType<Wv> extends true
					? ResolveExpressionAST<A["then"], Db, Scope, Params> extends infer Tv
						? Tv extends DbtyperErrorShape
							? Tv
							: Tv extends SqlTypeShape
								? MergeCaseThenAccum<Acc, Tv, AccAst, A["then"]> extends infer Merged
									? Merged extends DbtyperErrorShape
										? Merged
										: Merged extends SqlTypeShape
											? ResolveCaseSearchedArms<
													Rest,
													ElseB,
													Db,
													Scope,
													Merged,
													NextCaseAccAst<Acc, AccAst, A["then"]>,
													Params
												>
											: never
									: never
								: never
						: never
					: FormatError<Errors["CASE_WHEN_MUST_BE_BOOLEAN"], []>
				: FormatError<Errors["CASE_WHEN_MUST_BE_BOOLEAN"], []>
		: never
	: ElseB extends ScalarExprAst
		? ResolveExpressionAST<ElseB, Db, Scope, Params> extends infer Ev
			? Ev extends DbtyperErrorShape
				? Ev
				: Ev extends SqlTypeShape
					? MergeCaseThenAccum<Acc, Ev, AccAst, ElseB> extends infer F
						? F extends DbtyperErrorShape
							? F
							: F extends SqlTypeShape
								? ApplyCaseMissingElseNullability<F, false>
								: never
						: never
					: never
			: never
		: Acc extends SqlTypeShape
			? ApplyCaseMissingElseNullability<Acc, true>
			: never

type ResolveCaseSearched<
	Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	ElseB extends ScalarExprAst | null,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = ResolveCaseSearchedArms<Arms, ElseB, Db, Scope, null, never, Params>

type ResolveCaseSimpleArms<
	Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	ElseB extends ScalarExprAst | null,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Disc extends SqlTypeShape,
	DiscAst,
	Acc extends SqlTypeShape | null,
	AccAst,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Arms extends readonly [
	infer A extends { when: ScalarExprAst; then: ScalarExprAst },
	...infer Rest extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
]
	? ResolveExpressionAST<A["when"], Db, Scope, Params> extends infer Wv
		? Wv extends DbtyperErrorShape
			? Wv
			: Wv extends SqlTypeShape
				? WithEnumCheck<
						EnumComparisonCheck<Db, Disc, DiscAst, Wv, A["when"]>,
						ValidateCaseSimpleWhenMatch<Disc, Wv, DiscAst, A["when"]>
					> extends infer Match
					? Match extends DbtyperErrorShape
						? Match
						: Match extends true
							? ResolveExpressionAST<A["then"], Db, Scope, Params> extends infer Tv
								? Tv extends DbtyperErrorShape
									? Tv
									: Tv extends SqlTypeShape
										? MergeCaseThenAccum<Acc, Tv, AccAst, A["then"]> extends infer Merged
											? Merged extends DbtyperErrorShape
												? Merged
												: Merged extends SqlTypeShape
													? ResolveCaseSimpleArms<
															Rest,
															ElseB,
															Db,
															Scope,
															Disc,
															DiscAst,
															Merged,
															NextCaseAccAst<Acc, AccAst, A["then"]>,
															Params
														>
													: never
											: never
										: never
								: never
							: never
					: never
				: never
		: never
	: ElseB extends ScalarExprAst
		? ResolveExpressionAST<ElseB, Db, Scope, Params> extends infer Ev
			? Ev extends DbtyperErrorShape
				? Ev
				: Ev extends SqlTypeShape
					? MergeCaseThenAccum<Acc, Ev, AccAst, ElseB> extends infer F
						? F extends DbtyperErrorShape
							? F
							: F extends SqlTypeShape
								? ApplyCaseMissingElseNullability<F, false>
								: never
						: never
					: never
			: never
		: Acc extends SqlTypeShape
			? ApplyCaseMissingElseNullability<Acc, true>
			: never

type ResolveCaseSimple<
	DiscAst extends ScalarExprAst,
	Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	ElseB extends ScalarExprAst | null,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<DiscAst, Db, Scope, Params> extends infer Dv
		? Dv extends DbtyperErrorShape
			? Dv
			: Dv extends SqlTypeShape
				? ResolveCaseSimpleArms<Arms, ElseB, Db, Scope, Dv, DiscAst, null, never, Params>
				: never
		: never

/** Per-element check for `expr IN (…)` (same class rules as `=`, but `NULL` list elements are rejected). */
type ValidateInListElement<
	L extends SqlTypeShape,
	R extends SqlTypeShape,
	LAst = never,
	RAst = never,
> = L["type"] extends "null"
	? never
	: R["type"] extends "null"
		? FormatError<Errors["INCOMPATIBLE_TYPES_IN_IN_LIST"], []>
		: SameComparisonClass<L, R, LAst, RAst> extends true
			? true
			: FormatError<Errors["INCOMPATIBLE_TYPES_IN_IN_LIST"], []>

type ResolveInListItemsAgainstLeft<
	Left extends SqlTypeShape,
	LeftAst,
	Items extends readonly ScalarExprAst[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Items extends readonly [infer H extends ScalarExprAst, ...infer Tail extends readonly ScalarExprAst[]]
	? ResolveExpressionAST<H, Db, Scope, Params> extends infer Hv
		? Hv extends DbtyperErrorShape
			? Hv
			: Hv extends SqlTypeShape
				? WithEnumCheck<
						EnumComparisonCheck<Db, Left, LeftAst, Hv, H>,
						ValidateInListElement<Left, Hv, LeftAst, H>
					> extends infer V
					? V extends DbtyperErrorShape
						? V
						: V extends true
							? Tail extends readonly []
								? SqlBoolean
								: ResolveInListItemsAgainstLeft<Left, LeftAst, Tail, Db, Scope, Params>
							: never
					: never
				: never
		: never
	: FormatError<Errors["IN_LIST_MUST_NOT_BE_EMPTY"], []>

type ResolveScalarSubquerySel<S extends JsqlSelectStatementResult> =
	SingleProjectionColumn<S["returning"]> extends true
		? keyof S["returning"] extends infer K extends keyof S["returning"]
			? S["returning"][K] extends infer ColType extends SqlTypeShape
				? Nullable<ColType> // CORE-4: a scalar subquery may return no row
				: FormatError<Errors["SCALAR_SUBQUERY_COLUMN_INFERENCE_FAILED"], []>
			: FormatError<Errors["SCALAR_SUBQUERY_COLUMN_INFERENCE_FAILED"], []>
		: FormatError<Errors["SCALAR_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN"], []>

type SubSelectColumnAtom<S extends JsqlSelectStatementResult> =
	SingleProjectionColumn<S["returning"]> extends true
		? keyof S["returning"] extends infer K extends keyof S["returning"]
			? S["returning"][K] extends infer ColType extends SqlTypeShape
				? ColType
				: FormatError<Errors["IN_SUBQUERY_COLUMN_INFERENCE_FAILED"], []>
			: FormatError<Errors["IN_SUBQUERY_COLUMN_INFERENCE_FAILED"], []>
		: FormatError<Errors["IN_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN"], []>

type ResolveInSubqueryAst<
	Lexpr extends ScalarExprAst,
	Sub extends JsqlSelectStatementResult,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<Lexpr, Db, Scope, Params> extends infer Lv
		? Lv extends DbtyperErrorShape
			? Lv
			: Lv extends SqlTypeShape
				? SubSelectColumnAtom<Sub> extends infer Rv
					? Rv extends DbtyperErrorShape
						? Rv
						: Rv extends SqlTypeShape
							? ValidateInListElement<Lv, Rv> extends infer V
								? V extends DbtyperErrorShape
									? V
									: V extends true
										? SqlBoolean
										: FormatError<Errors["INCOMPATIBLE_TYPES_IN_IN_SUBQUERY"], []>
								: FormatError<Errors["INCOMPATIBLE_TYPES_IN_IN_SUBQUERY"], []>
							: never
					: never
				: never
		: never

type ResolveAnyAllSomeOp<
	_Op extends string,
	L extends ScalarExprAst,
	R extends ScalarExprAst | JsqlSelectStatementResult,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<L, Db, Scope, Params> extends infer Lv
		? Lv extends DbtyperErrorShape
			? Lv
			: Lv extends SqlTypeShape
				? R extends JsqlSelectStatementResult
					? SubSelectColumnAtom<R> extends infer Rv
						? Rv extends DbtyperErrorShape
							? Rv
							: Rv extends SqlTypeShape
								? MergeComparison<Lv, Rv> extends infer V
									? V extends DbtyperErrorShape
										? V
										: SqlBoolean
									: never
								: never
						: never
					: R extends ScalarExprAst
						? ResolveExpressionAST<R, Db, Scope, Params> extends infer Rv
							? Rv extends DbtyperErrorShape
								? Rv
								: Rv extends SqlTypeShape
									? Rv["type"] extends "array" | "unknown"
										? SqlBoolean
										: FormatError<Errors["ANY_ALL_SOME_REQUIRES_ARRAY_OR_SUBQUERY"], []>
									: never
							: never
						: never
				: never
		: never

type MergeBoolNot<V> = V extends DbtyperErrorShape
	? V
	: V extends SqlTypeShape
		? V["type"] extends "null"
			? FormatError<Errors["NOT_ARGUMENT_MUST_BE_BOOLEAN_NOT_NULL"], []>
			: IsSqlBooleanType<V> extends true
				? SqlBoolean
				: FormatError<Errors["NOT_REQUIRES_BOOLEAN_OPERAND"], []>
		: FormatError<Errors["NOT_REQUIRES_BOOLEAN_OPERAND"], []>

type MergeBoolBinary<
	L,
	R,
	ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN" | "OR_OPERANDS_MUST_BE_BOOLEAN",
> = L extends DbtyperErrorShape
	? L
	: R extends DbtyperErrorShape
		? R
		: L extends SqlTypeShape
			? R extends SqlTypeShape
				? L["type"] extends "null"
					? FormatError<Errors["NULL_NOT_VALID_BOOLEAN_OPERAND"], []>
					: R["type"] extends "null"
						? FormatError<Errors["NULL_NOT_VALID_BOOLEAN_OPERAND"], []>
						: IsSqlBooleanType<L> extends true
							? IsSqlBooleanType<R> extends true
								? SqlBoolean
								: ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN"
									? FormatError<Errors["AND_OPERANDS_MUST_BE_BOOLEAN"], []>
									: FormatError<Errors["OR_OPERANDS_MUST_BE_BOOLEAN"], []>
							: ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN"
								? FormatError<Errors["AND_OPERANDS_MUST_BE_BOOLEAN"], []>
								: FormatError<Errors["OR_OPERANDS_MUST_BE_BOOLEAN"], []>
				: ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN"
					? FormatError<Errors["AND_OPERANDS_MUST_BE_BOOLEAN"], []>
					: FormatError<Errors["OR_OPERANDS_MUST_BE_BOOLEAN"], []>
			: ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN"
				? FormatError<Errors["AND_OPERANDS_MUST_BE_BOOLEAN"], []>
				: FormatError<Errors["OR_OPERANDS_MUST_BE_BOOLEAN"], []>

/** PGT-14: a string literal cast to an enum must be one of its labels; `Cast` otherwise. */
type WithCastLabelCheck<Db, Cast, Ast> = Cast extends SqlTypeShape
	? WithEnumCheck<EnumCastCheck<Db, Cast, Ast>, Cast>
	: Cast

/** `CAST` / `::` result typing for SqlTypeShape (PostgreSQL-oriented compatibility checks). */
/** SQLT-6: in a chain whose type names only decide an affinity (SQLite) a CAST gives the type of that affinity, from any value. */
type ResolveCastForDialect<Db, Ev extends SqlTypeShape, N extends string> =
	DialectFact<Db, "typeNames"> extends "affinity"
		? Ev["type"] extends "null"
			? SqlNull
			: SqlType<SqliteTypeKey<N>>
		: N extends `${infer Sch}.${infer Tn}`
			? CastToNamedType<Db, Ev, Sch, Tn>
			: CastToNamedType<Db, Ev, DefaultSchemaOf<Db>, N>

/** PGT-13, PGT-22: a cast to a type name: an enum or a domain of the chain, else a built-in type. */
type CastToNamedType<Db, Ev extends SqlTypeShape, Schema extends string, N extends string> =
	ResolveUserType<Db, Schema, SqlType<N>> extends [infer U extends SqlTypeShape, boolean]
		? U["type"] extends N
			? ResolveCastFromShape<Ev, N>
			: U
		: ResolveCastFromShape<Ev, N>

type DefaultSchemaOf<Db> = Db extends { defaultSchema: infer D extends string } ? D : ""

type ResolveCastFromShape<Ev extends SqlTypeShape, N extends string> = Ev["type"] extends "null"
	? SqlNull
	: N extends "text" | "varchar" | "character varying" | "char"
		? SqlText
		: N extends "integer" | "int" | "int4" | "smallint" | "int2" | "serial" | "smallserial"
			? Ev["type"] extends "boolean"
				? DbtyperError<4503, "Cannot cast boolean to integer">
				: SqlInteger
			: N extends "bigint" | "int8" | "bigserial"
				? Ev["type"] extends "boolean"
					? DbtyperError<4503, "Cannot cast boolean to integer">
					: SqlBigint
				: N extends "boolean" | "bool"
					? Ev["type"] extends "integer" | "bigint" | "numeric"
						? DbtyperError<4504, "Cannot cast integer to boolean">
						: SqlBoolean
					: N extends "uuid"
						? SqlUuid
						: N extends "bytea"
							? SqlType<"bytea">
							: N extends
										| "timestamp"
										| "timestamp with time zone"
										| "timestamptz"
										| "date"
										| "time"
										| "time with time zone"
										| "timetz"
										| "interval"
								? SqlType<N>
								: N extends "inet" | "cidr"
									? SqlType<N>
									: N extends "tsvector" | "tsquery"
										? SqlType<N>
										: N extends
													| "real"
													| "float4"
													| "double precision"
													| "float8"
													| "numeric"
													| "decimal"
											? SqlNumeric
											: SqlType<N>

// Old unused functions removed (ResolveCastFromAtom, MergeNumericArithmetic)
// These were part of the legacy ExprAtom system and are no longer needed

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

type ParseOtherOpScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
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

/** SQLT-35: in SQLite a literal with a decimal point or an exponent is REAL; elsewhere every number literal is the integer shape. */
type NumberLiteralType<Db, Raw extends string> =
	DialectFact<Db, "typeNames"> extends "affinity"
		? Raw extends `0${"x" | "X"}${string}`
			? SqlInteger
			: Raw extends `${string}${"." | "e" | "E"}${string}`
				? SqlType<"real">
				: SqlInteger
		: SqlInteger

/**
 * The type of `a op b` for two numeric operands: the left operand's, except where the type names are affinities
 * (SQLite, SQLT-35): with any REAL operand the result is REAL, else a NUMERIC operand makes it NUMERIC.
 */
type ArithmeticResult<Db, Lv extends SqlTypeShape, Rv extends SqlTypeShape> =
	DialectFact<Db, "typeNames"> extends "affinity"
		? "real" extends Lv["type"] | Rv["type"]
			? SqlType<"real">
			: "numeric" extends Lv["type"] | Rv["type"]
				? SqlType<"numeric">
				: Lv
		: Lv

type ResolveScalarExprAstPair<
	L extends ScalarExprAst,
	R extends ScalarExprAst,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	Op extends string = "",
> =
	ResolveExpressionAST<L, Db, Scope, Params> extends infer Lv
		? Lv extends DbtyperErrorShape
			? Lv
			: ResolveExpressionAST<R, Db, Scope, Params> extends infer Rv
				? Rv extends DbtyperErrorShape
					? Rv
					: Lv extends SqlTypeShape
						? Rv extends SqlTypeShape
							? Lv["type"] extends "null"
								? FormatError<Errors["NULL_NOT_ALLOWED_ARITHMETIC"], []>
								: Rv["type"] extends "null"
									? FormatError<Errors["NULL_NOT_ALLOWED_ARITHMETIC"], []>
									: PgDatetimeArithmetic<Db, Op, Lv, Rv> extends infer Dt
										? [Dt] extends [never]
											? ResolveNumericPair<Db, Lv, Rv>
											: Dt
										: never
							: never
						: never
				: never
		: never

/**
 * PGT-30: `timestamp ± interval` is the timestamp's type, `timestamp - timestamp` an `interval`, `date ± integer`
 * a `date`, `date - date` an `integer`. `never` for any other operands (the numeric rules apply).
 */
type PgDatetimeArithmetic<Db, Op extends string, Lv extends SqlTypeShape, Rv extends SqlTypeShape> = Op extends
	| "add"
	| "sub"
	? DialectFact<Db, "typeNames"> extends "named"
		? Lv["type"] extends "timestamp" | "timestamp with time zone" | "timestamp without time zone" | "date"
			? Rv["type"] extends "interval"
				? PgNullableIfEither<Lv, Rv, Lv>
				: Lv["type"] extends "date"
					? Rv["type"] extends "integer" | "smallint" | "bigint"
						? PgNullableIfEither<Lv, Rv, Lv>
						: Op extends "sub"
							? Rv["type"] extends "date"
								? PgNullableIfEither<Lv, Rv, SqlInteger>
								: never
							: never
					: Op extends "sub"
						? Rv["type"] extends Lv["type"]
							? PgNullableIfEither<Lv, Rv, SqlType<"interval">>
							: never
						: never
			: Lv["type"] extends "interval"
				? Rv["type"] extends "interval"
					? PgNullableIfEither<Lv, Rv, Lv>
					: never
				: never
		: never
	: never

type PgNullableIfEither<
	Lv extends SqlTypeShape,
	Rv extends SqlTypeShape,
	Result extends SqlTypeShape,
> = Lv["nullable"] extends true ? Nullable<Result> : Rv["nullable"] extends true ? Nullable<Result> : Result

type ResolveNumericPair<Db, Lv extends SqlTypeShape, Rv extends SqlTypeShape> =
	IsSqlNumericType<Lv["type"]> extends true
		? IsSqlNumericType<Rv["type"]> extends true
			? ArithmeticResult<Db, Lv, Rv>
			: FormatError<Errors["INCOMPATIBLE_TYPES_IN_ARITHMETIC"], []>
		: FormatError<Errors["INCOMPATIBLE_TYPES_IN_ARITHMETIC"], []>

type ResolveScalarExprAstNeg<
	I extends ScalarExprAst,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<I, Db, Scope, Params> extends infer U
		? U extends DbtyperErrorShape
			? U
			: U extends SqlTypeShape
				? IsSqlNumericType<U["type"]> extends true
					? U
					: FormatError<Errors["UNARY_MINUS_REQUIRES_A_NUMBER"], []>
				: FormatError<Errors["UNARY_MINUS_REQUIRES_A_NUMBER"], []>
		: never

// ============================================================================
// OLD PARSING FUNCTIONS REMOVED (2026-05-07)
// ============================================================================
// The following functions were part of the legacy ExprAtom system and have been removed:
// - TryValueOperand
// - ParseValuePgCastSuffix
// - ParseMulLoopAfterFirst
// - ParseMulValue
// - ParseAddLoopAfterFirst
// - ParseAddValue
//
// These functions returned ExprOk<string> (string-based types) and are no longer needed.
// The new approach uses:
//   1. ParseExpressionAST - builds AST (no types)
//   2. ResolveExpressionAST - resolves AST to SqlTypeShape
//
// This provides better separation of concerns and consistency with SELECT parsing.
// ============================================================================
