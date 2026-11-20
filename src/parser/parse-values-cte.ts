/**
 * SEL-40: a CTE body `VALUES (…)[, (…) …]` (both dialects, before SELECT and before INSERT / UPDATE / DELETE, DML-21).
 * Its columns are `column1`, `column2`, … (renamed by a CTE column list, CORE-12); a column's type is the common type
 * of its cells across the rows, as for `UNION ALL` (CORE-8, the same `MergeSetOperation`, so incompatible cells are
 * 3409 "… in VALUES for column …"). A cell is an expression without FROM. A parameter cell takes its column's type from
 * the other cells (CORE-6); a column of parameters and NULL only is CORE-7.
 */
import type { ComparisonClassesOf } from "../core/dialect.ts"
import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { CollectParamProbes, ParamProbeFound, ParamUnresolved, ProbeKeyOf } from "../core/param-probe.ts"
import type { NonNull, SqlTypeShape } from "../core/sql-type-shape.ts"
import type { Inc } from "../core/type-utils.ts"
import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { ParserMonad, PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ExpressionParamsShape, ScalarExprAst } from "./parse-expression.ts"
import type { ParseExpressionAST } from "./parse-expression.ts"
import type { ResolveExpressionAST } from "./resolve-expression.ts"
import type { WithErrorClause } from "./resolve-column-ref.ts"
import type { MergeSetOperation } from "./set-operation-types.ts"
import type { SkipFailedExpression } from "./skip-statement.ts"

type Row = readonly SqlTypeShape[]

/** After `VALUES`: the rows, then the result `[rest, JsqlSelectStatementResult | error]` (the CTE's `)` not read). */
export type ParseValuesBody<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
> =
	ParseValuesRows<Tokens, Db, Params, []> extends [infer R extends ParserMonad, infer Rows]
		? Rows extends DbtyperErrorShape
			? [R, Rows]
			: Rows extends readonly [infer First extends Row, ...infer Rest extends readonly Row[]]
				? ValuesResult<First, Rest, Db> extends infer Res
					? Res extends DbtyperErrorShape
						? SkipFailedExpression<R, Res>
						: [R, Res]
					: never
				: never
		: never

/** `(cell, …)[, (cell, …) …]`: `[rest, rows | error]`. */
type ParseValuesRows<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Acc extends readonly Row[],
> =
	PeekToken<Tokens> extends TokenKey<"(">
		? ParseValuesCells<SkipToken<Tokens>, Db, Params, []> extends [infer R extends ParserMonad, infer Cells]
			? Cells extends DbtyperErrorShape
				? [R, Cells]
				: Cells extends Row
					? PeekToken<R> extends TokenKey<",">
						? ParseValuesRows<SkipToken<R>, Db, Params, [...Acc, Cells]>
						: [R, [...Acc, Cells]]
					: never
			: never
		: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_OPEN_PAREN_IN_VALUES"], []>>

/** The cells of one row up to its `)`, each resolved without FROM: `[rest after ")", cells | error]`. */
type ParseValuesCells<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Acc extends Row,
> =
	ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: {} }> extends [
		infer R1 extends ParserMonad,
		infer Ast,
		infer _Env,
	]
		? Ast extends DbtyperErrorShape
			? SkipFailedExpression<R1, Ast>
			: Ast extends ScalarExprAst
				? ResolveExpressionAST<Ast, Db, {}, Params> extends infer Cell
					? Cell extends DbtyperErrorShape
						? SkipFailedExpression<R1, WithErrorClause<Cell, "VALUES">>
						: Cell extends SqlTypeShape
							? PeekToken<R1> extends TokenKey<",">
								? ParseValuesCells<SkipToken<R1>, Db, Params, [...Acc, Cell]>
								: PeekToken<R1> extends TokenKey<")">
									? [SkipToken<R1>, [...Acc, Cell]]
									: SkipFailedExpression<
											R1,
											FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_IN_VALUES_ROW"], []>
										>
							: never
					: never
				: never
		: never

/** `column1`, `column2`, … for `N` columns. */
type ColumnNames<N extends number, Acc extends readonly string[] = []> = Acc["length"] extends N
	? Acc
	: ColumnNames<N, [...Acc, `column${Inc<Acc["length"]>}`]>

/** One row as a result with the names `Names` (in order). */
type RowResult<Cells extends Row, Names extends readonly string[]> = {
	kind: "select"
	returning: { [I in keyof Names & `${number}` as Names[I]]: Cells[I & keyof Cells] }
	order: Names
}

/** Every row has the first row's length (3417); parameter cells first (CORE-6, CORE-7); then the common types. */
type ValuesResult<
	First extends Row,
	Rest extends readonly Row[],
	Db extends JsqlDatabaseShape,
> = Rest[number]["length"] extends First["length"]
	? ColumnNames<First["length"]> extends infer Names extends readonly string[]
		? ValuesProbes<[First, ...Rest], 0, First["length"], null> extends infer Found
			? Found extends DbtyperErrorShape
				? Found
				: MergeRows<RowResult<First, Names>, Rest, Names, ComparisonClassesOf<Db>>
			: never
		: never
	: FormatError<Errors["VALUES_ROW_LENGTH_MISMATCH"], []>

type MergeRows<
	Acc extends JsqlSelectStatementResult,
	Rest extends readonly Row[],
	Names extends readonly string[],
	Classes,
> = Rest extends readonly [infer H extends Row, ...infer T extends readonly Row[]]
	? MergeSetOperation<Acc, RowResult<H, Names>, "VALUES", Classes> extends infer M
		? M extends JsqlSelectStatementResult
			? MergeRows<M, T, Names, Classes>
			: M
		: never
	: Acc

/**
 * The parameter cells of the columns `I…N-1`: a parameter of a column with a typed cell gets that cell's type (the
 * probes of all columns are collected, one round binds them); a column of parameters and NULL only is CORE-7.
 */
type ValuesProbes<Rows extends readonly Row[], I extends number, N extends number, Found> = I extends N
	? Found
	: ColumnProbe<{ [K in keyof Rows]: Rows[K][I & keyof Rows[K]] }> extends infer P
		? ValuesProbes<Rows, Inc<I>, N, P extends null ? Found : Found extends null ? P : CollectParamProbes<Found, P>>
		: never

/** The first parameter cell of a column with the column's first typed cell, or `null` when no cell is a parameter. */
type ColumnProbe<Cells extends readonly unknown[]> =
	FirstProbeKey<Cells> extends infer K extends string | number
		? [K] extends [never]
			? null
			: FirstTypedCell<Cells> extends infer S extends SqlTypeShape
				? ParamProbeFound<K, NonNull<S>>
				: ParamUnresolved<K>
		: null

type FirstProbeKey<Cells extends readonly unknown[]> = Cells extends readonly [infer H, ...infer T]
	? [ProbeKeyOf<H>] extends [never]
		? FirstProbeKey<T>
		: ProbeKeyOf<H>
	: never

type FirstTypedCell<Cells extends readonly unknown[]> = Cells extends readonly [infer H, ...infer T]
	? [ProbeKeyOf<H>] extends [never]
		? H extends { type: "null" }
			? FirstTypedCell<T>
			: H
		: FirstTypedCell<T>
	: null
