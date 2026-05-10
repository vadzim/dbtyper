import type {
	JsqlDatabaseShape,
	JsqlInsertStatementResult,
	JsqlSelectStatementResult,
	JsqlDataShape,
} from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { FormatError, DbtyperError } from "../sql-parser-error.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { MergeScope, ScopeMap } from "./parser-scope.ts"
import type { ValidateMutationValueForColumn } from "./parser-validate-mutation-value.ts"
import type {
	EmptyExpressionParams,
	ExpressionParamsShape,
	SameComparisonClass,
	ParseExpressionAST,
	ScalarExprAst,
	ResolveExpressionAST,
} from "./parse-expression.ts"
import type { ParseAndResolveReturningClause, ParseSelectExpression } from "./parse-select.ts"
import type { ParseWhereExpression } from "./parse-where-expression.ts"
import type { JsqlDbGetData, JsqlDataGetColumnType } from "../core/jsql-utils.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"

/** Returned when a suffix `ParseInsertValuesCells` pass consumed `)` closing the physical `VALUES` row; tail is handled by the caller. */
type InsertValuesRowCellsParsedMarker = { readonly __insertValuesRowCellsParsed: true }

type InsertTableContext = {
	scope: ScopeMap
	tbl: JsqlDataShape
	schema: string
	table: string
}

type ParseInsertAliasAfterTable<
	Tokens extends TokensList,
	_Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape,
	_Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"(">
		? [
				Tokens,
				null,
				{
					scope: MergeScope<
						Record<
							Tab,
							{
								schema: Sch
								table: Tab
								columns: Tbl["columns"]
							}
						>,
						{}
					>
					tbl: Tbl
					schema: Sch
					table: Tab
				},
			]
		: PeekToken<Tokens> extends infer TokAlias
			? SkipToken<Tokens> extends infer Ra extends TokensList
				? TokAlias extends TokenIdent<infer Alias extends string>
					? PeekToken<Ra> extends TokenKey<"(">
						? [
								Ra,
								null,
								{
									scope: MergeScope<
										Record<
											Alias,
											{
												schema: Sch
												table: Tab
												columns: Tbl["columns"]
											}
										>,
										{}
									>
									tbl: Tbl
									schema: Sch
									table: Tab
								},
							]
						: [
								Ra,
								FormatError<"EXPECTED_OPEN_PAREN_COLUMN_LIST_AFTER_TABLE_IN_INSERT", []>,
								ParserRefErrorThirdSentinel,
							]
					: [
							Ra,
							FormatError<"EXPECTED_OPEN_PAREN_COLUMN_LIST_AFTER_TABLE_IN_INSERT", []>,
							ParserRefErrorThirdSentinel,
						]
				: never
			: never

type ParseInsertFromTableRef<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends infer Tok
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? Tok extends TokenIdent<infer A extends string>
				? PeekToken<R1> extends TokenKey<".">
					? SkipToken<R1> extends infer R2 extends TokensList
						? PeekToken<R2> extends infer TokB
							? SkipToken<R2> extends infer R3 extends TokensList
								? TokB extends TokenIdent<infer B extends string>
									? JsqlDbGetData<Db, A, B> extends infer TblTry
										? [TblTry] extends [never]
											? [
													R3,
													FormatError<"UNKNOWN_SCHEMA_OR_TABLE_IN_INSERT_INTO", [A, B]>,
													ParserRefErrorThirdSentinel,
												]
											: TblTry extends JsqlDataShape
												? ParseInsertAliasAfterTable<R3, Db, A, B, TblTry, Params>
												: [
														R3,
														FormatError<"UNKNOWN_SCHEMA_OR_TABLE_IN_INSERT_INTO", [A, B]>,
														ParserRefErrorThirdSentinel,
													]
										: never
									: [
											R3,
											FormatError<"EXPECTED_TABLE_NAME_AFTER_DOT_IN_INSERT_INTO", []>,
											ParserRefErrorThirdSentinel,
										]
								: never
							: never
						: never
					: JsqlDbGetData<Db, Db["defaultSchema"], A> extends infer TblTry
						? [TblTry] extends [never]
							? [R1, FormatError<"UNKNOWN_TABLE_INSERT_INTO", [A]>, ParserRefErrorThirdSentinel]
							: TblTry extends JsqlDataShape
								? ParseInsertAliasAfterTable<R1, Db, Db["defaultSchema"], A, TblTry, Params>
								: [R1, FormatError<"UNKNOWN_TABLE_INSERT_INTO", [A]>, ParserRefErrorThirdSentinel]
						: never
				: [R1, FormatError<"EXPECTED_TABLE_NAME_IN_INSERT_INTO", []>, ParserRefErrorThirdSentinel]
			: never
		: never

type ParseInsertColumnNameList<Tokens extends TokensList, Tbl extends JsqlDataShape, Acc extends readonly string[]> =
	PeekToken<Tokens> extends TokenKey<")">
		? Acc extends readonly []
			? SkipFailedExpression<Tokens, FormatError<"INSERT_COLUMN_LIST_MUST_NOT_BE_EMPTY", []>>
			: [Tokens, Acc]
		: PeekToken<Tokens> extends infer Tok
			? SkipToken<Tokens> extends infer R1 extends TokensList
				? Tok extends TokenIdent<infer Col extends string>
					? JsqlDataGetColumnType<Tbl, Col> extends null
						? SkipFailedExpression<R1, FormatError<"UNKNOWN_COLUMN_IN_INSERT_COLUMN_LIST", [Col]>>
						: PeekToken<R1> extends TokenKey<")">
							? SkipToken<R1> extends infer R2 extends TokensList
								? [R2, readonly [...Acc, Col]]
								: never
							: PeekToken<R1> extends TokenKey<",">
								? SkipToken<R1> extends infer R3 extends TokensList
									? ParseInsertColumnNameList<R3, Tbl, readonly [...Acc, Col]>
									: never
								: SkipFailedExpression<
										R1,
										FormatError<"EXPECTED_COMMA_OR_CLOSE_PAREN_IN_INSERT_COLUMN_LIST", []>
									>
					: SkipFailedExpression<R1, FormatError<"EXPECTED_COLUMN_NAME_IN_INSERT_COLUMN_LIST", []>>
				: never
			: never

type IsNotNullInsertColumn<Tbl extends JsqlDataShape, Col extends string> = Tbl extends {
	column_facts: infer Facts extends Record<string, unknown>
}
	? Col extends keyof Facts
		? Facts[Col] extends { nullability: "not_null" }
			? Facts[Col] extends { default: true }
				? false
				: true
			: false
		: false
	: false

type MissingRequiredInsertColumn<Tbl extends JsqlDataShape, Cols extends readonly string[]> = {
	[K in Extract<keyof Tbl["columns"], string>]: IsNotNullInsertColumn<Tbl, K> extends true
		? K extends Cols[number]
			? never
			: K
		: never
}[Extract<keyof Tbl["columns"], string>]

type ValidateInsertRequiredColumns<Tbl extends JsqlDataShape, Cols extends readonly string[]> =
	MissingRequiredInsertColumn<Tbl, Cols> extends infer Missing
		? [Missing] extends [never]
			? true
			: Missing extends string
				? FormatError<"MISSING_NOT_NULL_COLUMN_IN_INSERT", [Missing]>
				: FormatError<"MISSING_NOT_NULL_COLUMN_IN_INSERT", [string]>
		: never

type ParseInsertAfterOpenParenCols<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
> =
	PeekToken<Tokens> extends TokenKey<"(">
		? SkipToken<Tokens> extends infer R0 extends TokensList
			? ParseInsertColumnNameList<R0, Tbl, readonly []> extends [infer R1 extends TokensList, infer ColsOrErr]
				? ColsOrErr extends DbtyperError<any, any>
					? [R1, Db, ColsOrErr]
					: ColsOrErr extends readonly string[]
						? ParseInsertAfterColumnNames<R1, Db, Scope, Params, Tbl, Sch, Tab, ColsOrErr>
						: never
				: never
			: never
		: never

type ParseInsertAfterColumnNames<
	R1 extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	PeekToken<R1> extends infer TkValues
		? TkValues extends TokenKey<"values">
			? SkipToken<R1> extends infer Rv extends TokensList
				? ValidateInsertRequiredColumns<Tbl, Cols> extends infer RequiredColsOk
					? RequiredColsOk extends DbtyperError<any, any>
						? [Rv, Db, RequiredColsOk]
						: ParseInsertAfterValuesKeyword<Rv, Db, Scope, Params, Tbl, Sch, Tab, Cols>
					: never
				: never
			: TkValues extends TokenKey<"select">
				? ParseInsertWithSelect<R1, Db, Scope, Params, Tbl, Sch, Tab, Cols>
				: SkipToken<R1> extends infer Rv extends TokensList
					? [Rv, Db, FormatError<"EXPECTED_VALUES_OR_SELECT_AFTER_COLUMN_LIST_IN_INSERT", []>]
					: never
		: never

type ParseInsertWithSelect<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	_Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	ParseSelectExpression<Tokens, Db, Params> extends [infer RSelect extends TokensList, infer Db2, infer SelectRes]
		? SelectRes extends DbtyperError<any, any>
			? [RSelect, Db2, SelectRes]
			: SelectRes extends JsqlSelectStatementResult
				? ValidateInsertSelectColumns<Tbl, Cols, SelectRes> extends infer ValidationRes
					? ValidationRes extends DbtyperError<any, any>
						? [RSelect, Db2, ValidationRes]
						: ValidationRes extends true
							? Db2 extends JsqlDatabaseShape
								? FinishInsertSemicolon<
										RSelect,
										Db2,
										{
											kind: "insert"
											table: Tab
											schema: Sch
											columns: Cols
										}
									>
								: never
							: never
					: never
				: never
		: never

type ValidateInsertSelectColumns<
	Tbl extends JsqlDataShape,
	InsertCols extends readonly string[],
	SelectRes extends JsqlSelectStatementResult,
> =
	ValidateInsertSelectColumnCount<InsertCols, SelectRes> extends infer CountCheck
		? CountCheck extends DbtyperError<any, any>
			? CountCheck
			: ValidateInsertSelectColumnTypes<Tbl, InsertCols, SelectRes, InsertCols>
		: never

type ValidateInsertSelectColumnCount<
	InsertCols extends readonly string[],
	SelectRes extends JsqlSelectStatementResult,
> = InsertCols["length"] extends keyof SelectRes["columns"] & number
	? true
	: FormatError<"INSERT_SELECT_COLUMN_COUNT_MISMATCH", []>

type ValidateInsertSelectColumnTypes<
	Tbl extends JsqlDataShape,
	InsertCols extends readonly string[],
	SelectRes extends JsqlSelectStatementResult,
	AllCols extends readonly string[],
	Idx extends readonly unknown[] = [],
> = InsertCols extends readonly [infer Col extends string, ...infer RestCols extends readonly string[]]
	? Idx["length"] extends keyof SelectRes["columns"] & number
		? SelectRes["columns"][Idx["length"]] extends infer SelectType extends SqlTypeShape
			? JsqlDataGetColumnType<Tbl, Col> extends infer InsertType extends SqlTypeShape
				? SameComparisonClass<SelectType, InsertType> extends true
					? ValidateInsertSelectColumnTypes<Tbl, RestCols, SelectRes, AllCols, readonly [...Idx, 0]>
					: FormatError<"INSERT_SELECT_TYPE_MISMATCH_FOR_COLUMN", [Col]>
				: FormatError<"UNKNOWN_COLUMN_INSERT", [Col]>
			: FormatError<"SELECT_RESULT_MISSING_COLUMN", []>
		: FormatError<"SELECT_RESULT_COLUMN_INDEX_OUT_OF_BOUNDS", []>
	: true

/** Unwrap `InsertValuesRowCellsParsedMarker` after a `VALUES` row cell pass (same rules as after `VALUES (`). */
type ParseInsertAfterValuesCellsOutcome<
	Rf extends TokensList,
	Db2 extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	Res,
> =
	Res extends DbtyperError<any, any>
		? [Rf, Db2, Res]
		: [Extract<Res, InsertValuesRowCellsParsedMarker>] extends [never]
			? Res extends JsqlInsertStatementResult
				? [Rf, Db2, Res]
				: never
			: ParseInsertAfterValuesRowClose<Rf, Db2, Scope, Params, Tbl, Sch, Tab, Cols>

type ParseInsertAfterValuesKeyword<
	Rv extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	PeekToken<Rv> extends infer TkOpen
		? SkipToken<Rv> extends infer Rvals extends TokensList
			? TkOpen extends TokenKey<"(">
				? ParseInsertValuesCells<Rvals, Db, Scope, Params, Tbl, Sch, Tab, Cols, Cols> extends [
						infer Rf extends TokensList,
						infer Db2 extends JsqlDatabaseShape,
						infer Res,
					]
					? ParseInsertAfterValuesCellsOutcome<Rf, Db2, Scope, Params, Tbl, Sch, Tab, Cols, Res> extends [
							infer ROut extends TokensList,
							infer DbOut extends JsqlDatabaseShape,
							infer Out3,
						]
						? Out3 extends DbtyperError<any, any>
							? [ROut, DbOut, Out3]
							: Out3 extends JsqlInsertStatementResult
								? FinishInsertSemicolon<ROut, DbOut, Out3>
								: never
						: never
					: never
				: SkipFailedStatement<Rvals, Db, FormatError<"EXPECTED_OPEN_PAREN_AFTER_VALUES_IN_INSERT", []>>
			: never
		: never

type ParseInsertValuesCells<
	Tokens extends TokensList,
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
			infer R1 extends TokensList,
			infer Ast,
		]
		? Ast extends DbtyperError<any, any>
			? [R1, Db, Ast]
			: Ast extends ScalarExprAst
				? ResolveExpressionAST<Ast, Db, Scope, Params> extends infer Resolved
					? Resolved extends DbtyperError<any, any>
						? [R1, Db, Resolved]
						: Resolved extends SqlTypeShape
							? ValidateMutationValueForColumn<Tbl, C0, Resolved> extends infer V0
								? V0 extends DbtyperError<any, any>
									? [R1, Db, V0]
									: V0 extends true
										? CR extends readonly []
											? PeekToken<R1> extends infer TokCl
												? SkipToken<R1> extends infer R2 extends TokensList
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
																		"EXPECTED_CLOSE_PAREN_AFTER_INSERT_VALUES",
																		[]
																	>
															  > extends [infer Rest extends TokensList, infer Err]
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
	Tokens extends TokensList,
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
		? SkipToken<Tokens> extends infer Rc extends TokensList
			? ParseInsertValuesCells<Rc, Db, Scope, Params, Tbl, Sch, Tab, CR, ColsFull>
			: never
		: SkipFailedStatement<Tokens, Db, FormatError<"EXPECTED_COMMA_BETWEEN_INSERT_VALUES", []>>

type InsertExcludedScope<
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

type BuildInsertResult<
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	UpsertCols extends readonly string[] | undefined,
	Returning extends JsqlSelectStatementResult | undefined,
> = { kind: "insert"; schema: Sch; table: Tab; columns: Cols } & ([UpsertCols] extends [undefined]
	? {}
	: { on_conflict_update_set_columns: UpsertCols }) &
	([Returning] extends [undefined] ? {} : { returning: Returning }) extends infer R extends JsqlInsertStatementResult
	? R
	: never

type ParseInsertAfterValuesRowClose<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	PeekToken<R2> extends TokenKey<",">
		? SkipToken<R2> extends infer R3 extends TokensList
			? PeekToken<R3> extends infer TokLp
				? SkipToken<R3> extends infer R4 extends TokensList
					? TokLp extends TokenKey<"(">
						? ParseInsertValuesCells<R4, Db, Scope, Params, Tbl, Sch, Tab, Cols, Cols> extends [
								infer Rf2 extends TokensList,
								infer Db3 extends JsqlDatabaseShape,
								infer Res2,
							]
							? ParseInsertAfterValuesCellsOutcome<Rf2, Db3, Scope, Params, Tbl, Sch, Tab, Cols, Res2>
							: never
						: SkipFailedExpression<
									R4,
									FormatError<"EXPECTED_OPEN_PAREN_AFTER_COMMA_BETWEEN_INSERT_VALUES_ROWS", []>
							  > extends [infer Rest extends TokensList, infer Err]
							? [Rest, Db, Err]
							: never
					: never
				: never
			: never
		: ParseInsertOptionalTail<R2, Db, Scope, Params, Tbl, Sch, Tab, Cols, undefined, undefined>

type ParseInsertOptionalTail<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	UpsertCols extends readonly string[] | undefined,
	Returning extends JsqlSelectStatementResult | undefined,
> =
	PeekToken<Tokens> extends TokenKey<"on">
		? SkipToken<Tokens> extends infer ROn extends TokensList
			? PeekToken<ROn> extends TokenKey<"conflict">
				? SkipToken<ROn> extends infer Rcf extends TokensList
					? ParseInsertOnConflictDoUpdate<Rcf, Db, Scope, Params, Tbl, Sch, Tab, Cols>
					: never
				: SkipFailedStatement<ROn, Db, FormatError<"EXPECTED_CONFLICT_AFTER_ON_IN_INSERT", []>>
			: never
		: ParseInsertMaybeReturning<Tokens, Db, Scope, Params, Tbl, Sch, Tab, Cols, UpsertCols, Returning>

type ParseInsertOnConflictDoUpdate<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	PeekToken<Tokens> extends infer T0
		? SkipToken<Tokens> extends infer R0 extends TokensList
			? T0 extends TokenKey<"(">
				? ParseInsertOnConflictAfterOpenParen<R0, Db, Scope, Params, Tbl, Sch, Tab, Cols>
				: SkipFailedStatement<R0, Db, FormatError<"EXPECTED_OPEN_PAREN_AFTER_ON_CONFLICT_IN_INSERT", []>>
			: never
		: never

type ParseInsertOnConflictAfterOpenParen<
	R0 extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	ParseInsertConflictColList<R0, Tbl, readonly []> extends [infer R1 extends TokensList, infer CRes]
		? CRes extends DbtyperError<any, any>
			? [R1, Db, CRes]
			: CRes extends readonly string[]
				? ParseInsertOnConflictAfterConflictCloseParen<R1, Db, Scope, Params, Tbl, Sch, Tab, Cols>
				: never
		: never

type ParseInsertOnConflictAfterConflictCloseParen<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	PeekToken<R2> extends TokenKey<"do">
		? PeekToken<R2> extends infer TDo
			? SkipToken<R2> extends infer R3 extends TokensList
				? TDo extends TokenKey<"do">
					? ParseInsertOnConflictAfterDoKw<R3, Db, Scope, Params, Tbl, Sch, Tab, Cols>
					: SkipFailedExpression<
								R3,
								FormatError<"EXPECTED_DO_AFTER_ON_CONFLICT_COLUMNS_IN_INSERT", []>
						  > extends [infer Rest extends TokensList, infer Err]
						? [Rest, Db, Err]
						: never
				: never
			: never
		: SkipFailedStatement<R2, Db, FormatError<"EXPECTED_DO_AFTER_ON_CONFLICT_COLUMN_LIST_IN_INSERT", []>>

type ParseInsertOnConflictAfterDoKw<
	R3 extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	PeekToken<R3> extends infer TUp
		? SkipToken<R3> extends infer R4 extends TokensList
			? TUp extends TokenKey<"update">
				? ParseInsertOnConflictAfterUpdateKw<R4, Db, Scope, Params, Tbl, Sch, Tab, Cols>
				: SkipFailedStatement<R4, Db, FormatError<"EXPECTED_UPDATE_AFTER_DO_IN_INSERT_ON_CONFLICT", []>>
			: never
		: never

type ParseInsertOnConflictAfterUpdateKw<
	R4 extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	PeekToken<R4> extends infer TSet
		? SkipToken<R4> extends infer R5 extends TokensList
			? TSet extends TokenKey<"set">
				? InsertExcludedScope<Sch, Tab, Tbl, Scope> extends infer UpsertScope extends ScopeMap
					? ParseInsertUpsertSetAssignments<R5, Db, UpsertScope, Params, Tbl, readonly []> extends [
							infer R6 extends TokensList,
							infer Db6 extends JsqlDatabaseShape,
							infer SetOut,
						]
						? SetOut extends DbtyperError<any, any>
							? [R6, Db6, SetOut]
							: SetOut extends readonly string[]
								? ParseInsertAfterUpsertSet<R6, Db6, UpsertScope, Params, Tbl, Sch, Tab, Cols, SetOut>
								: never
						: never
					: never
				: SkipFailedStatement<R5, Db, FormatError<"EXPECTED_SET_AFTER_UPDATE_IN_INSERT_ON_CONFLICT", []>>
			: never
		: never

type ParseInsertConflictColList<Tokens extends TokensList, Tbl extends JsqlDataShape, Acc extends readonly string[]> =
	PeekToken<Tokens> extends TokenKey<")">
		? Acc extends readonly []
			? SkipFailedExpression<Tokens, FormatError<"ON_CONFLICT_COLUMN_LIST_MUST_NOT_BE_EMPTY", []>>
			: PeekToken<Tokens> extends TokenKey<")">
				? SkipToken<Tokens> extends infer R extends TokensList
					? [R, Acc]
					: never
				: never
		: PeekToken<Tokens> extends infer Tok
			? SkipToken<Tokens> extends infer R1 extends TokensList
				? Tok extends TokenIdent<infer C extends string>
					? JsqlDataGetColumnType<Tbl, C> extends null
						? SkipFailedExpression<R1, FormatError<"UNKNOWN_COLUMN_IN_ON_CONFLICT", [C]>>
						: PeekToken<R1> extends TokenKey<")">
							? SkipToken<R1> extends infer R2 extends TokensList
								? [R2, readonly [...Acc, C]]
								: never
							: PeekToken<R1> extends TokenKey<",">
								? SkipToken<R1> extends infer R3 extends TokensList
									? ParseInsertConflictColList<R3, Tbl, readonly [...Acc, C]>
									: never
								: SkipFailedExpression<
										R1,
										FormatError<"EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ON_CONFLICT_COLUMN_LIST", []>
									>
					: SkipFailedExpression<R1, FormatError<"EXPECTED_COLUMN_NAME_IN_ON_CONFLICT", []>>
				: never
			: never

type ParseInsertUpsertSetAssignments<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Acc extends readonly string[],
> =
	PeekToken<Tokens> extends infer TokCol
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? TokCol extends TokenIdent<infer Col extends string>
				? JsqlDataGetColumnType<Tbl, Col> extends null
					? [R1, Db, FormatError<"UNKNOWN_COLUMN_IN_ON_CONFLICT_DO_UPDATE_SET", [Col]>]
					: PeekToken<R1> extends TokenKey<"=">
						? SkipToken<R1> extends infer R2 extends TokensList
							? ParseExpressionAST<R2, { db: Db; params: Params; outerScope: Scope }> extends [
									infer R3 extends TokensList,
									infer Ast,
								]
								? Ast extends DbtyperError<any, any>
									? [R3, Db, Ast]
									: Ast extends ScalarExprAst
										? ResolveExpressionAST<Ast, Db, Scope, Params> extends infer Resolved
											? Resolved extends DbtyperError<any, any>
												? [R3, Db, Resolved]
												: Resolved extends SqlTypeShape
													? ValidateMutationValueForColumn<
															Tbl,
															Col,
															Resolved
														> extends infer V0
														? V0 extends DbtyperError<any, any>
															? [R3, Db, V0]
															: V0 extends true
																? PeekToken<R3> extends TokenKey<",">
																	? SkipToken<R3> extends infer R4 extends TokensList
																		? ParseInsertUpsertSetAssignments<
																				R4,
																				Db,
																				Scope,
																				Params,
																				Tbl,
																				readonly [...Acc, Col]
																			>
																		: never
																	: PeekToken<R3> extends
																				| TokenKey<"where">
																				| TokenKey<";">
																				| TokenEot
																		? [R3, Db, readonly [...Acc, Col]]
																		: [
																				R3,
																				Db,
																				FormatError<
																					"EXPECTED_COMMA_WHERE_OR_END_AFTER_ON_CONFLICT_SET",
																					[]
																				>,
																			]
																: never
														: never
													: never
											: never
										: SkipFailedExpression<
													R3,
													never
											  > extends [infer Rest extends TokensList, infer Err]
											? [Rest, Db, Err]
											: never
								: never
							: never
						: SkipFailedStatement<
								R1,
								Db,
								FormatError<"EXPECTED_EQUALS_AFTER_COLUMN_IN_ON_CONFLICT_UPDATE", []>
							>
				: SkipFailedStatement<R1, Db, FormatError<"EXPECTED_COLUMN_NAME_IN_ON_CONFLICT_UPDATE", []>>
			: never
		: never

type ParseInsertAfterUpsertSet<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	UpsertScope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	SetCols extends readonly string[],
> =
	PeekToken<Tokens> extends TokenKey<"where">
		? SkipToken<Tokens> extends infer Rw0 extends TokensList
			? ParseWhereExpression<Rw0, Db, UpsertScope, Params> extends [infer Rw extends TokensList, infer We]
				? We extends DbtyperError<any, any>
					? [Rw, Db, We]
					: ParseInsertMaybeReturning<Rw, Db, UpsertScope, Params, Tbl, Sch, Tab, Cols, SetCols, undefined>
				: never
			: never
		: ParseInsertMaybeReturning<Tokens, Db, UpsertScope, Params, Tbl, Sch, Tab, Cols, SetCols, undefined>

type ParseInsertMaybeReturning<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	_Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	UpsertCols extends readonly string[] | undefined,
	Returning extends JsqlSelectStatementResult | undefined,
> =
	PeekToken<Tokens> extends TokenKey<"returning">
		? SkipToken<Tokens> extends infer Rr extends TokensList
			? ParseAndResolveReturningClause<Rr, Db, Scope, Params> extends [
					infer Ra extends TokensList,
					infer DbA extends JsqlDatabaseShape,
					infer Ret,
				]
				? Ret extends DbtyperError<any, any>
					? [Ra, DbA, Ret]
					: Ret extends JsqlSelectStatementResult
						? FinishInsertSemicolon<Ra, DbA, BuildInsertResult<Sch, Tab, Cols, UpsertCols, Ret>>
						: never
				: never
			: never
		: FinishInsertSemicolon<Tokens, Db, BuildInsertResult<Sch, Tab, Cols, UpsertCols, Returning>>

type FinishInsertSemicolon<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Res extends JsqlInsertStatementResult,
> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, Db, Res]
		: SkipFailedStatement<Tokens, Db, FormatError<"EXPECTED_SEMICOLON_AFTER_INSERT", []>>

type ParseInsertAfterInto<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
> =
	ParseInsertFromTableRef<Tokens, Db, Params> extends [infer R extends TokensList, infer Mid, infer Third]
		? Mid extends DbtyperError<any, any>
			? Third extends ParserRefErrorThirdSentinel
				? [R, Db, Mid]
				: never
			: Mid extends null
				? Third extends InsertTableContext
					? ParseInsertAfterOpenParenCols<
							R,
							Db,
							Third["scope"],
							Params,
							Third["tbl"],
							Third["schema"],
							Third["table"]
						>
					: never
				: never
		: never

export type ParseInsert<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends TokenKey<"into">
		? ParseInsertAfterInto<SkipToken<Tokens>, Db, Params>
		: SkipFailedStatement<Tokens, Db, FormatError<"EXPECTED_INTO_AFTER_INSERT", []>>
