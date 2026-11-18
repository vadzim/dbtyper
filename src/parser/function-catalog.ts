import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { Nullable, SqlArray, SqlTypeShape } from "../core/sql-type-shape.ts"
import type { PostgresFunctions, PostgresSqliteOnlyFunctions } from "./postgres-functions.ts"
import type { SqliteFunctions, SqlitePgOnlyFunctions } from "./sqlite-functions.ts"

/**
 * The function catalog grammar shared by the dialects (#116 item 4). A dialect's data file (`SqliteFunctions`,
 * `PostgresFunctions`) is one row per function name (SQLite: `name/N` for exactly N arguments); the dialect fact
 * `functionCatalog` picks the table ({@link CatalogOf}) and ONE resolver (`ResolveCatalogFunctionCall` in
 * parse-expression.ts) reads it. A row is `[result, nulls, kind, arity, params]`:
 *
 * - `result`: a type name of the dialect's type map, or a code (`arg` the type of the first argument, `arg2` of the
 *   second, `common` the common type of all arguments, `common-tail` of all but the first, `first-value` the first
 *   argument that is not a NULL literal, `sum`/`avg` per argument type, `array-of-arg`, `text[]`, and the array
 *   functions `array-length`, `array-append`, `array-prepend`, `unnest`, which can give their own error, FN-19…FN-21).
 * - `nulls` (CORE-2): the names of {@link IsResultNullable}.
 * - `kind`: `"scalar"`, `"aggregate"` (also valid before OVER and in a grouped query as an aggregate) or `"window"`
 *   (needs OVER).
 * - `arity`: `null` (any count) or a key of {@link ArityRules}.
 * - `params`: the SQL type a parameter gets as argument N (CORE-6: a tuple of types by position), `"peer"` (the type
 *   of another argument), or `null` (a parameter there is not typed).
 */

/** The data table of a dialect. */
type CatalogOf<C extends string> = C extends "sqlite" ? SqliteFunctions : PostgresFunctions

type CatalogKey<Cat, L extends string, N extends number> = `${L}/${N}` extends keyof Cat
	? `${L}/${N}`
	: L extends keyof Cat
		? L
		: never

/** The row of function `L` called with `N` arguments in the catalog of dialect `C`, or `never`. */
export type CatalogRow<C extends string, L extends string, N extends number> =
	CatalogKey<CatalogOf<C>, L, N> extends infer K extends keyof CatalogOf<C> ? CatalogOf<C>[K] : never

/** Whether `L` is a function of the catalog of dialect `C` (with any argument count). */
export type IsCatalogFunction<C extends string, L extends string> = L extends keyof CatalogOf<C>
	? true
	: `${L}/1` extends keyof CatalogOf<C>
		? true
		: false

/** Whether the row needs an OVER clause. */
export type IsWindowOnlyRow<Row> = Row extends readonly [string, string, "window", ...unknown[]] ? true : false

/** Whether the row may be used before OVER (an aggregate or a window function). */
export type IsWindowCapableRow<Row> = Row extends readonly [string, string, "aggregate" | "window", ...unknown[]]
	? true
	: false

/**
 * Whether a call `L(...N arguments)` is an aggregate (the `"aggregate"` kind of its row in the catalog of the
 * chain's dialect: only SQLite overloads by argument count, `max(a, b)` is the scalar there).
 */
export type IsAggregateCall<D extends string, L extends string, N extends number> = IsAggregateRow<CatalogRow<D, L, N>>

type IsAggregateRow<Row> = [Row] extends [never]
	? false
	: Row extends readonly [string, string, "aggregate", ...unknown[]]
		? true
		: false

/**
 * Argument-count rules that are compile errors (FN-5, FN-7…FN-10, FN-12, FN-19…FN-21, FN-24):
 * `[min, max, error key]`, `-1` = no limit. Supported: min 0, 1 or 2 with no limit, or `min` = `max`.
 */
type ArityRules = {
	atLeastOne: [1, -1, "FUNCTION_REQUIRES_AT_LEAST_ONE_ARGUMENT"]
	coalesce: [1, -1, "COALESCE_REQUIRES_AT_LEAST_ONE_ARGUMENT"]
	sum: [1, -1, "SUM_REQUIRES_AN_ARGUMENT"]
	now: [0, 0, "NOW_TAKES_NO_ARGUMENTS"]
	noArgs: [0, 0, "THIS_FUNCTION_TAKES_NO_ARGUMENTS"]
	rowNumber: [0, 0, "ROW_NUMBER_TAKES_NO_ARGUMENTS"]
	rankDenseRank: [0, 0, "RANK_DENSE_RANK_TAKES_NO_ARGUMENTS"]
	lagLead: [1, -1, "LAG_LEAD_REQUIRES_AT_LEAST_1_ARGUMENT"]
	arrayLength: [2, 2, "ARRAY_LENGTH_REQUIRES_2_ARGUMENTS"]
	arrayAppend: [2, 2, "ARRAY_APPEND_REQUIRES_2_ARGUMENTS"]
	arrayPrepend: [2, 2, "ARRAY_PREPEND_REQUIRES_2_ARGUMENTS"]
	unnest: [1, 1, "UNNEST_REQUIRES_1_ARGUMENT"]
}

/** The errors of {@link ArityRules} by key. */
type ArityErrors = {
	FUNCTION_REQUIRES_AT_LEAST_ONE_ARGUMENT: FormatError<Errors["FUNCTION_REQUIRES_AT_LEAST_ONE_ARGUMENT"], []>
	COALESCE_REQUIRES_AT_LEAST_ONE_ARGUMENT: FormatError<Errors["COALESCE_REQUIRES_AT_LEAST_ONE_ARGUMENT"], []>
	SUM_REQUIRES_AN_ARGUMENT: FormatError<Errors["SUM_REQUIRES_AN_ARGUMENT"], []>
	NOW_TAKES_NO_ARGUMENTS: FormatError<Errors["NOW_TAKES_NO_ARGUMENTS"], []>
	THIS_FUNCTION_TAKES_NO_ARGUMENTS: FormatError<Errors["THIS_FUNCTION_TAKES_NO_ARGUMENTS"], []>
	ROW_NUMBER_TAKES_NO_ARGUMENTS: FormatError<Errors["ROW_NUMBER_TAKES_NO_ARGUMENTS"], []>
	RANK_DENSE_RANK_TAKES_NO_ARGUMENTS: FormatError<Errors["RANK_DENSE_RANK_TAKES_NO_ARGUMENTS"], []>
	LAG_LEAD_REQUIRES_AT_LEAST_1_ARGUMENT: FormatError<Errors["LAG_LEAD_REQUIRES_AT_LEAST_1_ARGUMENT"], []>
	ARRAY_LENGTH_REQUIRES_2_ARGUMENTS: FormatError<Errors["ARRAY_LENGTH_REQUIRES_2_ARGUMENTS"], []>
	ARRAY_APPEND_REQUIRES_2_ARGUMENTS: FormatError<Errors["ARRAY_APPEND_REQUIRES_2_ARGUMENTS"], []>
	ARRAY_PREPEND_REQUIRES_2_ARGUMENTS: FormatError<Errors["ARRAY_PREPEND_REQUIRES_2_ARGUMENTS"], []>
	UNNEST_REQUIRES_1_ARGUMENT: FormatError<Errors["UNNEST_REQUIRES_1_ARGUMENT"], []>
}

type EnoughArgs<Args extends readonly unknown[], Min extends number> = Min extends 0
	? true
	: Min extends 1
		? Args extends readonly [unknown, ...unknown[]]
			? true
			: false
		: Args extends readonly [unknown, unknown, ...unknown[]]
			? true
			: false

type ArgsFit<Args extends readonly unknown[], Min extends number, Max extends number> = Max extends -1
	? EnoughArgs<Args, Min>
	: Args["length"] extends Max
		? true
		: false

/** The arity error of a row for `Args`; `null` when the argument count is fine. */
export type CatalogArityError<Row, Args extends readonly unknown[]> = Row extends readonly [
	string,
	string,
	string,
	infer Rule extends keyof ArityRules,
	...unknown[],
]
	? ArityRules[Rule] extends readonly [
			infer Min extends number,
			infer Max extends number,
			infer Key extends keyof ArityErrors,
		]
		? ArgsFit<Args, Min, Max> extends true
			? null
			: ArityErrors[Key]
		: null
	: null

/** The hint table of the other dialect: names it has and this one lacks, with a replacement ("" for none). */
export type OtherDialectHints<C extends string> = C extends "sqlite"
	? SqlitePgOnlyFunctions
	: PostgresSqliteOnlyFunctions

/** How messages name the other dialect. */
export type OtherDialectTitle<C extends string> = C extends "sqlite" ? "PostgreSQL" : "SQLite"

/**
 * CORE-6: the SQL type a parameter gets as argument `Index` of a call; `never` when the row gives none. `"peer"`
 * rows are handled by the caller ({@link IsPeerTypedRow}).
 */
export type RowArgType<Row, Index extends number> = Row extends readonly [string, string, string, unknown, infer P]
	? P extends readonly unknown[]
		? `${Index}` extends keyof P
			? P[`${Index}` & keyof P] extends infer S extends SqlTypeShape
				? S
				: never
			: never
		: never
	: never

/** A row whose arguments all share one type: a parameter takes the type of another argument. */
export type IsPeerTypedRow<Row> = Row extends readonly [string, string, string, unknown, "peer"] ? true : false

// ---- SQLite result codes ----

type Numeric = "integer" | "real" | "numeric" | "boolean" | "bigint"

type Common2<A extends string, B extends string> = A extends B
	? A
	: [A | B] extends [Numeric]
		? "real" extends A | B
			? "real"
			: "numeric" extends A | B
				? "numeric"
				: "integer"
		: "any"

/** Common type of argument types: null literals are ignored; equal types stay, numbers widen, otherwise `any`. */
type CommonType<Args extends readonly SqlTypeShape[], Acc extends string = never> = Args extends readonly [
	infer H extends SqlTypeShape,
	...infer T extends readonly SqlTypeShape[],
]
	? H["type"] extends "null"
		? CommonType<T, Acc>
		: [Acc] extends [never]
			? CommonType<T, H["type"]>
			: CommonType<T, Common2<Acc, H["type"]>>
	: [Acc] extends [never]
		? "null"
		: Acc

type Shape<T extends string> = { type: T; arg: null; nullable: false }

type Tail<Args extends readonly SqlTypeShape[]> = Args extends readonly [
	unknown,
	...infer T extends readonly SqlTypeShape[],
]
	? T
	: readonly []

type ResultShape<R extends string, Args extends readonly SqlTypeShape[]> = R extends "arg"
	? Args extends readonly [infer A extends SqlTypeShape, ...unknown[]]
		? { type: A["type"]; arg: A["arg"]; nullable: false }
		: Shape<"any">
	: R extends "common"
		? Shape<CommonType<Args>>
		: R extends "common-tail"
			? Shape<CommonType<Tail<Args>>>
			: R extends "sum"
				? Args extends readonly [{ type: "integer" | "boolean" | "bigint" }, ...unknown[]]
					? Shape<"integer">
					: Shape<"real">
				: Shape<R>

type AnyNullable<Args extends readonly SqlTypeShape[]> = Args extends readonly [
	infer H extends SqlTypeShape,
	...infer T extends readonly SqlTypeShape[],
]
	? H["nullable"] extends true
		? true
		: AnyNullable<T>
	: false

type AllNullable<Args extends readonly SqlTypeShape[]> = Args extends readonly [
	infer H extends SqlTypeShape,
	...infer T extends readonly SqlTypeShape[],
]
	? H["nullable"] extends true
		? AllNullable<T>
		: false
	: true

/** CORE-2 for one row: is the result nullable, given the argument types. */
type IsResultNullable<N extends string, Args extends readonly SqlTypeShape[]> = N extends "non-null"
	? false
	: N extends "null"
		? true
		: N extends "all"
			? Args extends readonly []
				? false
				: AllNullable<Args>
			: N extends "tail"
				? AnyNullable<Tail<Args>>
				: N extends "first"
					? Args extends readonly [infer F extends SqlTypeShape, ...unknown[]]
						? F["nullable"]
						: false
					: N extends "lag"
						? Args extends readonly [SqlTypeShape, SqlTypeShape, infer D extends SqlTypeShape]
							? D["nullable"] extends true
								? true
								: AnyNullable<Args>
							: true
						: AnyNullable<Args>

/** Result of a SQLite function row for resolved argument types. */
export type SqliteRowResult<Row, Args extends readonly SqlTypeShape[]> = Row extends readonly [
	infer R extends string,
	infer N extends string,
	...unknown[],
]
	? ResultShape<R, Args> extends infer S extends SqlTypeShape
		? IsResultNullable<N, Args> extends true
			? Nullable<S>
			: S
		: never
	: never

// ---- PostgreSQL result codes ----

/** The widest numeric type among the two (PostgreSQL's numeric hierarchy); other types keep the first. */
type PgCommon2<A extends string, B extends string> = A extends B
	? A
	: [A | B] extends [PgNumeric]
		? "double precision" extends A | B
			? "double precision"
			: "real" extends A | B
				? "real"
				: "numeric" extends A | B
					? "numeric"
					: "bigint" extends A | B
						? "bigint"
						: "integer"
		: A

type PgNumeric = "smallint" | "integer" | "bigint" | "numeric" | "real" | "double precision"

/** Common type of `greatest`/`least` arguments: NULL literals are ignored, numbers widen, else the first type. */
type PgCommonType<Args extends readonly SqlTypeShape[], Acc extends string = never> = Args extends readonly [
	infer H extends SqlTypeShape,
	...infer T extends readonly SqlTypeShape[],
]
	? H["type"] extends "null"
		? PgCommonType<T, Acc>
		: [Acc] extends [never]
			? PgCommonType<T, H["type"]>
			: PgCommonType<T, PgCommon2<Acc, H["type"]>>
	: [Acc] extends [never]
		? "null"
		: Acc

type FirstValue<Args extends readonly SqlTypeShape[]> = Args extends readonly [
	infer H extends SqlTypeShape,
	...infer T extends readonly SqlTypeShape[],
]
	? H["type"] extends "null"
		? FirstValue<T>
		: H
	: { type: "null"; arg: null; nullable: true }

/** PGT-27: `sum` over smallint/integer is bigint, over bigint/numeric numeric, over floats the same type. */
type PgSumType<T extends string> = T extends "smallint" | "integer"
	? "bigint"
	: T extends "real" | "double precision"
		? T
		: "numeric"

/** PGT-27: `avg` over integers and numeric is numeric, over floats double precision. */
type PgAvgType<T extends string> = T extends "real" | "double precision" ? "double precision" : "numeric"

type PgResultShape<R extends string, Args extends readonly SqlTypeShape[]> = R extends "arg"
	? Args extends readonly [infer A extends SqlTypeShape, ...unknown[]]
		? { type: A["type"]; arg: A["arg"]; nullable: false }
		: Shape<"unknown">
	: R extends "arg2"
		? Args extends readonly [unknown, infer A extends SqlTypeShape, ...unknown[]]
			? { type: A["type"]; arg: A["arg"]; nullable: false }
			: Shape<"unknown">
		: R extends "common"
			? Shape<PgCommonType<Args>>
			: R extends "first-value"
				? FirstValue<Args> extends infer F extends SqlTypeShape
					? { type: F["type"]; arg: F["arg"]; nullable: false }
					: never
				: R extends "sum"
					? Args extends readonly [infer A extends SqlTypeShape, ...unknown[]]
						? Shape<PgSumType<A["type"]>>
						: Shape<"numeric">
					: R extends "avg"
						? Args extends readonly [infer A extends SqlTypeShape, ...unknown[]]
							? Shape<PgAvgType<A["type"]>>
							: Shape<"numeric">
						: R extends "array-of-arg"
							? Args extends readonly [infer A extends SqlTypeShape, ...unknown[]]
								? SqlArray<{ type: A["type"]; arg: A["arg"]; nullable: false }>
								: Shape<"unknown">
							: R extends "text[]"
								? SqlArray<Shape<"text">>
								: R extends "array-length" | "array-append" | "array-prepend" | "unnest"
									? PgArrayFunctionResult<R, Args>
									: Shape<R>

/** Result of a PostgreSQL function row for resolved argument types (CORE-2 per the row). */
type PostgresRowResult<Row, Args extends readonly SqlTypeShape[]> = Row extends readonly [
	infer R extends string,
	infer N extends string,
	...unknown[],
]
	? PgResultShape<R, Args> extends infer S
		? S extends DbtyperErrorShape
			? S
			: S extends SqlTypeShape
				? IsResultNullable<N, Args> extends true
					? Nullable<S>
					: S
				: never
		: never
	: never

/** The result of a row of dialect `C` for resolved argument types. */
export type CatalogRowResult<C extends string, Row, Args extends readonly SqlTypeShape[]> = C extends "sqlite"
	? SqliteRowResult<Row, Args>
	: PostgresRowResult<Row, Args>

/** FN-19…FN-21: the array functions check their argument types (the argument count is the row's arity). */
type PgArrayFunctionResult<R extends string, Args extends readonly SqlTypeShape[]> = R extends "array-length"
	? Args extends readonly [infer S1 extends SqlTypeShape, SqlTypeShape]
		? S1["type"] extends "array" | "unknown"
			? Shape<"integer">
			: FormatError<Errors["ARRAY_LENGTH_EXPECTS_ARRAY_INTEGER"], []>
		: never
	: R extends "array-append"
		? Args extends readonly [infer S1 extends SqlTypeShape, SqlTypeShape]
			? S1["type"] extends "array" | "unknown"
				? S1
				: FormatError<Errors["ARRAY_APPEND_EXPECTS_ARRAY_ELEMENT"], []>
			: never
		: R extends "array-prepend"
			? Args extends readonly [SqlTypeShape, infer S2 extends SqlTypeShape]
				? S2["type"] extends "array" | "unknown"
					? S2
					: FormatError<Errors["ARRAY_PREPEND_EXPECTS_ELEMENT_ARRAY"], []>
				: never
			: Args extends readonly [infer S1 extends SqlTypeShape]
				? S1 extends { type: "array"; arg: infer E extends SqlTypeShape }
					? E
					: S1["type"] extends "array" | "unknown"
						? Shape<"unknown">
						: FormatError<Errors["UNNEST_EXPECTS_AN_ARRAY"], []>
				: never
