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
import type {
	ExpressionParamsShape,
	ParseExpressionAST,
	ScalarExprAst,
	ResolveExpressionAST,
} from "./parse-expression.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { FinishInsertSemicolon, InsertValuesRowCellsParsedMarker } from "./parse-insert.ts"
import type { ParseInsertOptionalTail } from "./parse-insert-on-conflict.ts"

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
								? FinishInsertSemicolon<ROut, DbOut, Out3>
								: never
						: never
					: never
				: SkipFailedStatement<Rvals, Db, FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_VALUES_IN_INSERT"], []>>
			: never
		: never

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
> = Cols extends readonly [infer C0 extends string, ...infer CR extends readonly string[]]
	? ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: Scope }> extends [
			infer R1 extends ParserMonad,
			infer Ast,
			infer _Env,
		]
		? Ast extends DbtyperErrorShape
			? [R1, Db, Ast]
			: Ast extends ScalarExprAst
				? ResolveExpressionAST<Ast, Db, Scope, Params> extends infer Resolved
					? Resolved extends DbtyperErrorShape
						? [R1, Db, WithErrorClause<Resolved, "INSERT VALUES">]
						: Resolved extends SqlTypeShape
							? ValidateMutationValueForColumn<Tbl, C0, Resolved, Db, Ast> extends infer V0
								? V0 extends DbtyperErrorShape
									? [R1, Db, V0]
									: V0 extends true
										? CR extends readonly []
											? PeekToken<R1> extends infer TokCl
												? SkipToken<R1> extends infer R2 extends ParserMonad
													? TokCl extends TokenKey<")">
														? Cols["length"] extends ColsFull["length"]
															? ParseInsertAfterValuesRowClose<
																	R2,
																	Db,
																	Scope,
																	Params,
																	Tbl,
																	Sch,
																	Tab,
																	ColsFull
																>
															: [R2, Db, InsertValuesRowCellsParsedMarker]
														: SkipFailedExpression<
																	R2,
																	FormatError<
																		Errors["EXPECTED_CLOSE_PAREN_AFTER_INSERT_VALUES"],
																		[]
																	>
															  > extends [infer Rest extends ParserMonad, infer Err]
															? [Rest, Db, Err]
															: never
													: never
												: never
											: ParseInsertValuesCommaThenRest<
													R1,
													Db,
													Scope,
													Params,
													Tbl,
													Sch,
													Tab,
													CR,
													ColsFull
												>
										: never
								: never
							: SkipFailedStatement<R1, Db, never>
					: never
				: SkipFailedStatement<R1, Db, never>
		: never
	: never

type ParseInsertValuesCommaThenRest<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	CR extends readonly string[],
	ColsFull extends readonly string[],
> =
	PeekToken<Tokens> extends TokenKey<",">
		? ParseInsertValuesCells<SkipToken<Tokens>, Db, Scope, Params, Tbl, Sch, Tab, CR, ColsFull>
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_COMMA_BETWEEN_INSERT_VALUES"], []>>

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
> =
	PeekToken<R2> extends TokenKey<",">
		? SkipToken<R2> extends infer R3 extends ParserMonad
			? PeekToken<R3> extends infer TokLp
				? SkipToken<R3> extends infer R4 extends ParserMonad
					? TokLp extends TokenKey<"(">
						? ParseInsertValuesCells<R4, Db, Scope, Params, Tbl, Sch, Tab, Cols, Cols> extends [
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
							? [Rest, Db, Err]
							: never
					: never
				: never
			: never
		: ParseInsertOptionalTail<R2, Db, Scope, Params, Tbl, Sch, Tab, Cols, undefined, undefined>
