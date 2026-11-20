import type { WithErrorClause } from "./resolve-column-ref.ts"
import type {
	JsqlDatabaseShape,
	JsqlInsertStatementResult,
	JsqlSelectStatementResult,
	JsqlDataShape,
} from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { MergeScope, ScopeMap } from "./parser-scope.ts"
import type { ValidateMutationValueForColumn } from "./parser-validate-mutation-value.ts"
import type { ExpressionParamsShape, ParseExpressionAST, ScalarExprAst } from "./parse-expression.ts"
import type { ResolveExpressionAST } from "./resolve-expression.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { CollectParamProbes, IsParamProbeFound } from "../core/param-probe.ts"
import type { InsertValuesRowCellsParsedMarker } from "./parse-insert.ts"
import type { ParseInsertOptionalTail } from "./parse-insert-on-conflict.ts"

/**
 * CORE-6 (#143): a VALUES row ended with parameter probes found in its cells. The next rows are still parsed, their
 * probes join `Found`, and all of them come out at the end of the VALUES list, so one round binds every probe of
 * a multi-row INSERT.
 */
type InsertValuesRowProbes<Found> = { __insert_values_row_probes__: Found }

/** Unwrap `InsertValuesRowCellsParsedMarker` after a `VALUES` row cell pass (same rules as after `VALUES (`). */
type ParseInsertAfterValuesCellsOutcome<
	Rf extends ParserMonad,
	Db2 extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	Res,
> = Res extends DbtyperErrorShape
	? [Rf, Db2, Res]
	: Res extends InsertValuesRowProbes<infer Found>
		? ParseInsertAfterValuesRowClose<Rf, Db2, Scope, Params, Tbl, Sch, Tab, Cols, Found>
		: [Extract<Res, InsertValuesRowCellsParsedMarker>] extends [never]
			? Res extends JsqlInsertStatementResult
				? [Rf, Db2, Res]
				: never
			: ParseInsertAfterValuesRowClose<Rf, Db2, Scope, Params, Tbl, Sch, Tab, Cols>

export type ParseInsertAfterValuesKeyword<
	Rv extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	PeekToken<Rv> extends infer TkOpen
		? SkipToken<Rv> extends infer Rvals extends ParserMonad
			? TkOpen extends TokenKey<"(">
				? ParseInsertValuesCells<Rvals, Db, Scope, Params, Tbl, Sch, Tab, Cols, Cols> extends [
						infer Rf extends ParserMonad,
						infer Db2 extends JsqlDatabaseShape,
						infer Res,
					]
					? ParseInsertAfterValuesCellsOutcome<Rf, Db2, Scope, Params, Tbl, Sch, Tab, Cols, Res> extends [
							infer ROut extends ParserMonad,
							infer DbOut extends JsqlDatabaseShape,
							infer Out3,
						]
						? Out3 extends DbtyperErrorShape
							? [ROut, DbOut, Out3]
							: Out3 extends JsqlInsertStatementResult
								? [ROut, DbOut, Out3] // the tail (ParseInsertOptionalTail) already consumed the `;`
								: never
						: never
					: never
				: SkipFailedStatement<Rvals, Db, FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_VALUES_IN_INSERT"], []>>
			: never
		: never

/**
 * The cells of one VALUES row. A cell whose parameter gets its type from the column (CORE-6) does not stop the row:
 * the probes of the whole row are collected in `Found` and come out together at the end of the row, so a wide
 * INSERT binds a row of parameters per round.
 */
type ParseInsertValuesCells<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	ColsFull extends readonly string[] = Cols,
	Found = null,
> = Cols extends readonly [infer C0 extends string, ...infer CR extends readonly string[]]
	? ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: Scope }> extends [
			infer R1 extends ParserMonad,
			infer Ast,
			infer _Env,
		]
		? Ast extends DbtyperErrorShape
			? [R1, Db, Found extends null ? Ast : Found]
			: Ast extends ScalarExprAst
				? ResolveExpressionAST<Ast, Db, Scope, Params> extends infer Resolved
					? Resolved extends DbtyperErrorShape
						? IsParamProbeFound<Resolved> extends true
							? ParseInsertValuesCellsNext<
									R1,
									Db,
									Scope,
									Params,
									Tbl,
									Sch,
									Tab,
									Cols,
									CR,
									ColsFull,
									FoundWith<Found, Resolved>
								>
							: [R1, Db, Found extends null ? WithErrorClause<Resolved, "INSERT VALUES"> : Found]
						: Resolved extends SqlTypeShape
							? ValidateMutationValueForColumn<Tbl, C0, Resolved, Db, Ast> extends infer V0
								? V0 extends DbtyperErrorShape
									? IsParamProbeFound<V0> extends true
										? ParseInsertValuesCellsNext<
												R1,
												Db,
												Scope,
												Params,
												Tbl,
												Sch,
												Tab,
												Cols,
												CR,
												ColsFull,
												FoundWith<Found, V0>
											>
										: [R1, Db, Found extends null ? V0 : Found]
									: V0 extends true
										? ParseInsertValuesCellsNext<
												R1,
												Db,
												Scope,
												Params,
												Tbl,
												Sch,
												Tab,
												Cols,
												CR,
												ColsFull,
												Found
											>
										: never
								: never
							: SkipFailedStatement<R1, Db, never>
					: never
				: SkipFailedStatement<R1, Db, never>
		: never
	: never

type FoundWith<Found, Probe> = Found extends null ? Probe : CollectParamProbes<Found, Probe>

/** After a cell: the next cell, or the end of the row (where the collected probes come out). */
type ParseInsertValuesCellsNext<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	CR extends readonly string[],
	ColsFull extends readonly string[],
	Found,
> = CR extends readonly []
	? PeekToken<R1> extends infer TokCl
		? SkipToken<R1> extends infer R2 extends ParserMonad
			? TokCl extends TokenKey<")">
				? Found extends null
					? Cols["length"] extends ColsFull["length"]
						? ParseInsertAfterValuesRowClose<R2, Db, Scope, Params, Tbl, Sch, Tab, ColsFull>
						: [R2, Db, InsertValuesRowCellsParsedMarker]
					: [R2, Db, InsertValuesRowProbes<Found>]
				: SkipFailedExpression<
							R2,
							Found extends DbtyperErrorShape
								? Found
								: FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_INSERT_VALUES"], []>
					  > extends [infer Rest extends ParserMonad, infer Err]
					? [Rest, Db, Err]
					: never
			: never
		: never
	: PeekToken<R1> extends TokenKey<",">
		? ParseInsertValuesCells<SkipToken<R1>, Db, Scope, Params, Tbl, Sch, Tab, CR, ColsFull, Found>
		: SkipFailedStatement<
				R1,
				Db,
				Found extends DbtyperErrorShape
					? Found
					: FormatError<Errors["EXPECTED_COMMA_BETWEEN_INSERT_VALUES"], []>
			>

export type InsertExcludedScope<
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape,
	BaseScope extends ScopeMap,
> = MergeScope<
	Record<
		"excluded",
		{
			schema: Sch
			table: Tab
			columns: Tbl["columns"]
		}
	>,
	BaseScope
>

export type BuildInsertResult<
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	UpsertCols extends readonly string[] | undefined,
	Returning extends JsqlSelectStatementResult | undefined,
> = { kind: "insert"; schema: Sch; table: Tab; columns: Cols } & ([UpsertCols] extends [undefined]
	? {}
	: { on_conflict_update_set_columns: UpsertCols }) &
	([Returning] extends [JsqlSelectStatementResult]
		? { returning: Returning["returning"] }
		: { returning: null }) extends infer R extends JsqlInsertStatementResult
	? R
	: never

type ParseInsertAfterValuesRowClose<
	R2 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	// probes found in the rows before (InsertValuesRowProbes)
	Found = null,
> =
	PeekToken<R2> extends TokenKey<",">
		? SkipToken<R2> extends infer R3 extends ParserMonad
			? PeekToken<R3> extends infer TokLp
				? SkipToken<R3> extends infer R4 extends ParserMonad
					? TokLp extends TokenKey<"(">
						? ParseInsertValuesCells<R4, Db, Scope, Params, Tbl, Sch, Tab, Cols, Cols, Found> extends [
								infer Rf2 extends ParserMonad,
								infer Db3 extends JsqlDatabaseShape,
								infer Res2,
							]
							? ParseInsertAfterValuesCellsOutcome<Rf2, Db3, Scope, Params, Tbl, Sch, Tab, Cols, Res2>
							: never
						: SkipFailedExpression<
									R4,
									FormatError<
										Errors["EXPECTED_OPEN_PAREN_AFTER_COMMA_BETWEEN_INSERT_VALUES_ROWS"],
										[]
									>
							  > extends [infer Rest extends ParserMonad, infer Err]
							? [Rest, Db, Found extends null ? Err : Found]
							: never
					: never
				: never
			: never
		: Found extends null
			? ParseInsertOptionalTail<R2, Db, Scope, Params, Tbl, Sch, Tab, Cols, undefined, undefined>
			: [R2, Db, Found]
