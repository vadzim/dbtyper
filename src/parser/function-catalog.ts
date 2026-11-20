import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { FunctionCatalogFacts } from "../core/dialect.ts"
import type { Dec } from "../core/type-utils.ts"

/**
 * The function catalog grammar shared by the dialects (#116 item 4). A dialect's data file (`SqliteFunctions`,
 * `PostgresFunctions`) is one row per function name (SQLite: `name/N` for exactly N arguments); the dialect fact
 * `functionCatalog` ({@link FunctionCatalogFacts}, called `C` below) holds the table (`rows`) and ONE resolver (`ResolveCatalogFunctionCall` in
 * resolve-function.ts) reads it. A row is `[result, nulls, kind, arity, params]`:
 *
 * - `result`: a type name of the dialect's type map, or a code (`arg` the type of the first argument, `arg2` of the
 *   second, `common` the common type of all arguments, `common-tail` of all but the first, `numeric-or-double` (`numeric` when an argument is, else `double precision`), `first-value` the first
 *   argument that is not a NULL literal, `sum`/`avg` per argument type, `array-of-arg`, `text[]`, and the array
 *   functions `array-length`, `array-append`, `array-prepend`, `unnest`, which can give their own error, FN-19…FN-21).
 * - `nulls` (CORE-2): the names of {@link IsResultNullable}.
 * - `kind`: `"scalar"`, `"aggregate"` (also valid before OVER and in a grouped query as an aggregate), `"window"`
 *   (needs OVER) or `"table"` (a table-valued function: a FROM item only, elsewhere unknown as in the engine; its
 *   columns are the `tables` row of the same name, its `result` is unused; SQLT-69…SQLT-72).
 * - `arity`: `null` (any count) or a key of {@link ArityRules}.
 * - `params`: the SQL type a parameter gets as argument N (CORE-6: a tuple of types by position, or `{ head; cycle }`:
 *   the `head` types, then the `cycle` types repeated, SQLT-75), `"peer"` (the type
 *   of another argument), or `null` (a parameter there is not typed).
 *
 * This file holds the row lookup and row predicates; the argument-count rules are in function-catalog-arity.ts and the
 * result codes and nullability names in function-catalog-result.ts.
 */

type CatalogKey<Cat, L extends string, N extends number> = `${L}/${N}` extends keyof Cat
	? `${L}/${N}`
	: L extends keyof Cat
		? L
		: never

/** The row of function `L` called with `N` arguments in the catalog of dialect `C`, or `never`. */
export type CatalogRow<C extends FunctionCatalogFacts, L extends string, N extends number> =
	CatalogKey<C["rows"], L, N> extends infer K extends keyof C["rows"] ? C["rows"][K] : never

/** Whether `L` is a function of the catalog of dialect `C` (with any argument count). */
export type IsCatalogFunction<C extends FunctionCatalogFacts, L extends string> = L extends keyof C["rows"]
	? true
	: `${L}/1` extends keyof C["rows"]
		? true
		: false

/** Whether the row is a table-valued function (a FROM item only). */
export type IsTableRow<Row> = Row extends readonly [string, string, "table", ...unknown[]] ? true : false

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
export type IsAggregateCall<D extends FunctionCatalogFacts, L extends string, N extends number> = IsAggregateRow<
	CatalogRow<D, L, N>
>

type IsAggregateRow<Row> = [Row] extends [never]
	? false
	: Row extends readonly [string, string, "aggregate", ...unknown[]]
		? true
		: false

/**
 * CORE-6: the SQL type a parameter gets as argument `Index` of a call; `never` when the row gives none. `"peer"`
 * rows are handled by the caller ({@link IsPeerTypedRow}).
 */
export type RowArgType<Row, Index extends number> = Row extends readonly [string, string, string, unknown, infer P]
	? P extends { head: infer H extends readonly unknown[]; cycle: infer C extends readonly SqlTypeShape[] }
		? CycleArgType<H, C, Index>
		: P extends readonly unknown[]
			? `${Index}` extends keyof P
				? P[`${Index}` & keyof P] extends infer S extends SqlTypeShape
					? S
					: never
				: never
			: never
	: never

/**
 * SQLT-75: the type at position `Index` of a repeating `params` entry `{ head; cycle }`: the `head` types by position,
 * then the `cycle` types again and again (the role of `json_set`'s 4th argument is that of its 2nd).
 */
type CycleArgType<
	H extends readonly unknown[],
	C extends readonly SqlTypeShape[],
	Index extends number,
	Rest extends readonly unknown[] = C,
> = H extends readonly [unknown, ...infer HT]
	? Index extends 0
		? H[0] extends infer S extends SqlTypeShape
			? S
			: never
		: CycleArgType<HT, C, Dec<Index>, C>
	: Index extends 0
		? Rest[0] extends infer S extends SqlTypeShape
			? S
			: never
		: Rest extends readonly [unknown, ...infer RT]
			? CycleArgType<[], C, Dec<Index>, RT extends readonly [] ? C : RT>
			: never

/** A row whose arguments all share one type: a parameter takes the type of another argument. */
export type IsPeerTypedRow<Row> = Row extends readonly [string, string, string, unknown, "peer"] ? true : false
