import type {
	JsqlColumnFactsMap,
	JsqlDatabaseShape,
	JsqlInsertStatementResult,
	JsqlSelectStatementResult,
	JsqlTableShape,
} from "../../core/jsql-shapes.ts"
import type {
	PeekToken,
	ReadToken,
	SkipToken,
	SqlParserError,
	TokenEot,
	TokenIdent,
	TokenKey,
	TokensList,
} from "../../core/sql-tokens.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { MergeScope, ScopeMap } from "./parser-scope.ts"
import type {
	EmptyExpressionParams,
	ExprAtom,
	ExprOk,
	ExprSqlNull,
	ExpressionParamsShape,
	ParseAddValue,
	SameComparisonClass,
} from "./parse-expression.ts"
import type { ParseAndResolveReturningClause } from "./parse-select.ts"
import type { ParseWhereExpression } from "./parse-where-expression.ts"
import type { ResolveTableShape } from "./resolve-table-shape.ts"

/** Returned when a suffix `ParseInsertValuesCells` pass consumed `)` closing the physical `VALUES` row; tail is handled by the caller. */
type InsertValuesRowCellsParsedMarker = { readonly __insertValuesRowCellsParsed: true }

export type SqlTypesOf<Tbl extends JsqlTableShape> = Tbl["column_sql_types"] extends infer S
	? S extends Record<string, string>
		? S
		: Record<string, string>
	: Record<string, string>

type InsertTableContext = {
	scope: ScopeMap
	tbl: JsqlTableShape
	schema: string
	table: string
}

type InsertColNotNull<Tbl extends JsqlTableShape, Col extends string> = Tbl extends {
	column_facts: infer F extends JsqlColumnFactsMap
}
	? Col extends keyof F
		? F[Col] extends { not_null: true }
			? true
			: false
		: false
	: false

export type ValidateMutationValueForColumn<
	Tbl extends JsqlTableShape,
	Col extends string,
	Val extends ExprAtom,
> = Col extends keyof Tbl["columns"]
	? Tbl["columns"][Col] extends infer ColTs
		? Val extends ExprSqlNull
			? InsertColNotNull<Tbl, Col> extends true
				? SqlParserError<"NULL not allowed for NOT NULL column">
				: true
			: Val extends ExprOk<infer TsV, infer _Sv>
				? SameComparisonClass<TsV, ColTs> extends true
					? true
					: SqlParserError<"Incompatible value type for column">
				: SqlParserError<"Invalid value expression">
		: never
	: SqlParserError<"Unknown column in INSERT">

type ParseInsertAliasAfterTable<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	_Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"(">
		? [
				Tokens,
				null,
				{
					scope: MergeScope<
						{},
						Record<
							Tab,
							{
								schema: Sch
								table: Tab
								columns: Tbl["columns"]
								column_sql_types: SqlTypesOf<Tbl>
							}
						>
					>
					tbl: Tbl
					schema: Sch
					table: Tab
				},
			]
		: ReadToken<Tokens> extends [infer Ra extends TokensList, infer TokAlias]
			? TokAlias extends TokenIdent<infer Alias extends string>
				? PeekToken<Ra> extends TokenKey<"(">
					? [
							Ra,
							null,
							{
								scope: MergeScope<
									{},
									Record<
										Alias,
										{
											schema: Sch
											table: Tab
											columns: Tbl["columns"]
											column_sql_types: SqlTypesOf<Tbl>
										}
									>
								>
								tbl: Tbl
								schema: Sch
								table: Tab
							},
						]
					: [
							Ra,
							SqlParserError<"Expected `(` (column list) after table in INSERT">,
							ParserRefErrorThirdSentinel,
						]
				: [Ra, SqlParserError<"Expected `(` (column list) after table in INSERT">, ParserRefErrorThirdSentinel]
			: never

type ParseInsertFromTableRef<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
> =
	ReadToken<Tokens> extends [infer R1 extends TokensList, infer Tok]
		? Tok extends TokenIdent<infer A extends string>
			? PeekToken<R1> extends TokenKey<".">
				? ReadToken<R1> extends [infer R2 extends TokensList, TokenKey<".">]
					? ReadToken<R2> extends [infer R3 extends TokensList, infer TokB]
						? TokB extends TokenIdent<infer B extends string>
							? ResolveTableShape<Db, A, B> extends infer TblTry
								? [TblTry] extends [never]
									? [
											R3,
											SqlParserError<"Unknown schema or table in INSERT INTO">,
											ParserRefErrorThirdSentinel,
										]
									: TblTry extends JsqlTableShape
										? ParseInsertAliasAfterTable<R3, Db, A, B, TblTry, Params>
										: [
												R3,
												SqlParserError<"Unknown schema or table in INSERT INTO">,
												ParserRefErrorThirdSentinel,
											]
								: never
							: [
									R3,
									SqlParserError<"Expected table name after `.` in INSERT INTO">,
									ParserRefErrorThirdSentinel,
								]
						: never
					: never
				: ResolveTableShape<Db, Db["defaultSchema"], A> extends infer TblTry
					? [TblTry] extends [never]
						? [R1, SqlParserError<"Unknown table in INSERT INTO">, ParserRefErrorThirdSentinel]
						: TblTry extends JsqlTableShape
							? ParseInsertAliasAfterTable<R1, Db, Db["defaultSchema"], A, TblTry, Params>
							: [R1, SqlParserError<"Unknown table in INSERT INTO">, ParserRefErrorThirdSentinel]
					: never
			: [R1, SqlParserError<"Expected table name in INSERT INTO">, ParserRefErrorThirdSentinel]
		: never

type ParseInsertColumnNameList<Tokens extends TokensList, Tbl extends JsqlTableShape, Acc extends readonly string[]> =
	PeekToken<Tokens> extends TokenKey<")">
		? Acc extends readonly []
			? [Tokens, SqlParserError<"INSERT column list must not be empty">]
			: [Tokens, Acc]
		: ReadToken<Tokens> extends [infer R1 extends TokensList, infer Tok]
			? Tok extends TokenIdent<infer Col extends string>
				? Col extends keyof Tbl["columns"]
					? PeekToken<R1> extends TokenKey<")">
						? ReadToken<R1> extends [infer R2 extends TokensList, TokenKey<")">]
							? [R2, readonly [...Acc, Col]]
							: never
						: PeekToken<R1> extends TokenKey<",">
							? ReadToken<R1> extends [infer R3 extends TokensList, TokenKey<",">]
								? ParseInsertColumnNameList<R3, Tbl, readonly [...Acc, Col]>
								: never
							: [R1, SqlParserError<"Expected `,` or `)` in INSERT column list">]
					: [R1, SqlParserError<"Unknown column in INSERT column list">]
				: [R1, SqlParserError<"Expected column name in INSERT column list">]
			: never

type ParseInsertAfterOpenParenCols<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlTableShape,
	Sch extends string,
	Tab extends string,
> =
	ReadToken<Tokens> extends [infer R0 extends TokensList, TokenKey<"(">]
		? ParseInsertColumnNameList<R0, Tbl, readonly []> extends [infer R1 extends TokensList, infer ColsOrErr]
			? ColsOrErr extends SqlParserError<string>
				? [R1, Db, ColsOrErr]
				: ColsOrErr extends readonly string[]
					? ParseInsertAfterColumnNames<R1, Db, Scope, Params, Tbl, Sch, Tab, ColsOrErr>
					: never
			: never
		: never

type ParseInsertAfterColumnNames<
	R1 extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlTableShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	ReadToken<R1> extends [infer Rv extends TokensList, infer TkValues]
		? TkValues extends TokenKey<"values">
			? ParseInsertAfterValuesKeyword<Rv, Db, Scope, Params, Tbl, Sch, Tab, Cols>
			: [Rv, Db, SqlParserError<"Expected VALUES after column list in INSERT">]
		: never

/** Unwrap `InsertValuesRowCellsParsedMarker` after a `VALUES` row cell pass (same rules as after `VALUES (`). */
type ParseInsertAfterValuesCellsOutcome<
	Rf extends TokensList,
	Db2 extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlTableShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	Res,
> =
	Res extends SqlParserError<string>
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
	Tbl extends JsqlTableShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	ReadToken<Rv> extends [infer Rvals extends TokensList, infer TkOpen]
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
					? Out3 extends SqlParserError<string>
						? [ROut, DbOut, Out3]
						: Out3 extends JsqlInsertStatementResult
							? FinishInsertSemicolon<ROut, DbOut, Out3>
							: never
					: never
				: never
			: [Rvals, Db, SqlParserError<"Expected `(` after VALUES in INSERT">]
		: never

type ParseInsertValuesCells<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlTableShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	ColsFull extends readonly string[] = Cols,
> = Cols extends readonly [infer C0 extends string, ...infer CR extends readonly string[]]
	? ParseAddValue<Tokens, Db, Scope, { catalogAccess: "three_part"; params: Params }> extends [
			infer R1 extends TokensList,
			infer Ev,
		]
		? Ev extends SqlParserError<string>
			? [R1, Db, Ev]
			: Ev extends ExprAtom
				? ValidateMutationValueForColumn<Tbl, C0, Ev> extends infer V0
					? V0 extends SqlParserError<string>
						? [R1, Db, V0]
						: V0 extends true
							? CR extends readonly []
								? ReadToken<R1> extends [infer R2 extends TokensList, infer TokCl]
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
										: [R2, Db, SqlParserError<"Expected `)` after INSERT values">]
									: never
								: ParseInsertValuesCommaThenRest<R1, Db, Scope, Params, Tbl, Sch, Tab, CR, ColsFull>
							: never
					: never
				: [R1, Db, SqlParserError<"Invalid value expression in INSERT">]
		: never
	: never

type ParseInsertValuesCommaThenRest<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlTableShape,
	Sch extends string,
	Tab extends string,
	CR extends readonly string[],
	ColsFull extends readonly string[],
> =
	PeekToken<Tokens> extends TokenKey<",">
		? ReadToken<Tokens> extends [infer Rc extends TokensList, TokenKey<",">]
			? ParseInsertValuesCells<Rc, Db, Scope, Params, Tbl, Sch, Tab, CR, ColsFull>
			: never
		: [Tokens, Db, SqlParserError<"Expected `,` between INSERT values">]

type InsertExcludedScope<
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	BaseScope extends ScopeMap,
> = MergeScope<
	BaseScope,
	Record<
		"excluded",
		{
			schema: Sch
			table: Tab
			columns: Tbl["columns"]
			column_sql_types: SqlTypesOf<Tbl>
		}
	>
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
	Tbl extends JsqlTableShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	PeekToken<R2> extends TokenKey<",">
		? ReadToken<R2> extends [infer R3 extends TokensList, TokenKey<",">]
			? ReadToken<R3> extends [infer R4 extends TokensList, infer TokLp]
				? TokLp extends TokenKey<"(">
					? ParseInsertValuesCells<R4, Db, Scope, Params, Tbl, Sch, Tab, Cols, Cols> extends [
							infer Rf2 extends TokensList,
							infer Db3 extends JsqlDatabaseShape,
							infer Res2,
						]
						? ParseInsertAfterValuesCellsOutcome<Rf2, Db3, Scope, Params, Tbl, Sch, Tab, Cols, Res2>
						: never
					: [R4, Db, SqlParserError<"Expected `(` after `,` between INSERT VALUES rows">]
				: never
			: never
		: ParseInsertOptionalTail<R2, Db, Scope, Params, Tbl, Sch, Tab, Cols, undefined, undefined>

type ParseInsertOptionalTail<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlTableShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	UpsertCols extends readonly string[] | undefined,
	Returning extends JsqlSelectStatementResult | undefined,
> =
	PeekToken<Tokens> extends TokenKey<"on">
		? ReadToken<Tokens> extends [infer ROn extends TokensList, TokenKey<"on">]
			? PeekToken<ROn> extends TokenKey<"conflict">
				? ReadToken<ROn> extends [infer Rcf extends TokensList, TokenKey<"conflict">]
					? ParseInsertOnConflictDoUpdate<Rcf, Db, Scope, Params, Tbl, Sch, Tab, Cols>
					: never
				: [ROn, Db, SqlParserError<"Expected CONFLICT after ON in INSERT">]
			: never
		: ParseInsertMaybeReturning<Tokens, Db, Scope, Params, Tbl, Sch, Tab, Cols, UpsertCols, Returning>

type ParseInsertOnConflictDoUpdate<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlTableShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	ReadToken<Tokens> extends [infer R0 extends TokensList, infer T0]
		? T0 extends TokenKey<"(">
			? ParseInsertOnConflictAfterOpenParen<R0, Db, Scope, Params, Tbl, Sch, Tab, Cols>
			: [R0, Db, SqlParserError<"Expected `(` after ON CONFLICT in INSERT">]
		: never

type ParseInsertOnConflictAfterOpenParen<
	R0 extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlTableShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	ParseInsertConflictColList<R0, Tbl, readonly []> extends [infer R1 extends TokensList, infer CRes]
		? CRes extends SqlParserError<string>
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
	Tbl extends JsqlTableShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	PeekToken<R2> extends TokenKey<"do">
		? ReadToken<R2> extends [infer R3 extends TokensList, infer TDo]
			? TDo extends TokenKey<"do">
				? ParseInsertOnConflictAfterDoKw<R3, Db, Scope, Params, Tbl, Sch, Tab, Cols>
				: [R3, Db, SqlParserError<"Expected DO after ON CONFLICT columns in INSERT">]
			: never
		: [R2, Db, SqlParserError<"Expected DO after ON CONFLICT column list in INSERT">]

type ParseInsertOnConflictAfterDoKw<
	R3 extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlTableShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	ReadToken<R3> extends [infer R4 extends TokensList, infer TUp]
		? TUp extends TokenKey<"update">
			? ParseInsertOnConflictAfterUpdateKw<R4, Db, Scope, Params, Tbl, Sch, Tab, Cols>
			: [R4, Db, SqlParserError<"Expected UPDATE after DO in INSERT ON CONFLICT">]
		: never

type ParseInsertOnConflictAfterUpdateKw<
	R4 extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlTableShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	ReadToken<R4> extends [infer R5 extends TokensList, infer TSet]
		? TSet extends TokenKey<"set">
			? InsertExcludedScope<Sch, Tab, Tbl, Scope> extends infer UpsertScope extends ScopeMap
				? ParseInsertUpsertSetAssignments<R5, Db, UpsertScope, Params, Tbl, readonly []> extends [
						infer R6 extends TokensList,
						infer Db6 extends JsqlDatabaseShape,
						infer SetOut,
					]
					? SetOut extends SqlParserError<string>
						? [R6, Db6, SetOut]
						: SetOut extends readonly string[]
							? ParseInsertAfterUpsertSet<R6, Db6, UpsertScope, Params, Tbl, Sch, Tab, Cols, SetOut>
							: never
					: never
				: never
			: [R5, Db, SqlParserError<"Expected SET after UPDATE in INSERT ON CONFLICT">]
		: never

type ParseInsertConflictColList<Tokens extends TokensList, Tbl extends JsqlTableShape, Acc extends readonly string[]> =
	PeekToken<Tokens> extends TokenKey<")">
		? Acc extends readonly []
			? [Tokens, SqlParserError<"ON CONFLICT column list must not be empty">]
			: ReadToken<Tokens> extends [infer R extends TokensList, TokenKey<")">]
				? [R, Acc]
				: never
		: ReadToken<Tokens> extends [infer R1 extends TokensList, infer Tok]
			? Tok extends TokenIdent<infer C extends string>
				? C extends keyof Tbl["columns"]
					? PeekToken<R1> extends TokenKey<")">
						? ReadToken<R1> extends [infer R2 extends TokensList, TokenKey<")">]
							? [R2, readonly [...Acc, C]]
							: never
						: PeekToken<R1> extends TokenKey<",">
							? ReadToken<R1> extends [infer R3 extends TokensList, TokenKey<",">]
								? ParseInsertConflictColList<R3, Tbl, readonly [...Acc, C]>
								: never
							: [R1, SqlParserError<"Expected `,` or `)` in ON CONFLICT column list">]
					: [R1, SqlParserError<"Unknown column in ON CONFLICT">]
				: [R1, SqlParserError<"Expected column name in ON CONFLICT">]
			: never

type ParseInsertUpsertSetAssignments<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlTableShape,
	Acc extends readonly string[],
> =
	ReadToken<Tokens> extends [infer R1 extends TokensList, infer TokCol]
		? TokCol extends TokenIdent<infer Col extends string>
			? Col extends keyof Tbl["columns"]
				? PeekToken<R1> extends TokenKey<"=">
					? ReadToken<R1> extends [infer R2 extends TokensList, TokenKey<"=">]
						? ParseAddValue<R2, Db, Scope, { catalogAccess: "three_part"; params: Params }> extends [
								infer R3 extends TokensList,
								infer Ev,
							]
							? Ev extends SqlParserError<string>
								? [R3, Db, Ev]
								: Ev extends ExprAtom
									? ValidateMutationValueForColumn<Tbl, Col, Ev> extends infer V0
										? V0 extends SqlParserError<string>
											? [R3, Db, V0]
											: V0 extends true
												? PeekToken<R3> extends TokenKey<",">
													? ReadToken<R3> extends [infer R4 extends TokensList, TokenKey<",">]
														? ParseInsertUpsertSetAssignments<
																R4,
																Db,
																Scope,
																Params,
																Tbl,
																readonly [...Acc, Col]
															>
														: never
													: PeekToken<R3> extends TokenKey<"where"> | TokenKey<";"> | TokenEot
														? [R3, Db, readonly [...Acc, Col]]
														: [
																R3,
																Db,
																SqlParserError<"Expected `,`, WHERE, or end after ON CONFLICT SET">,
															]
												: never
										: never
									: [R3, Db, SqlParserError<"Invalid value expression in ON CONFLICT UPDATE">]
							: never
						: never
					: [R1, Db, SqlParserError<"Expected `=` after column in ON CONFLICT UPDATE">]
				: [R1, Db, SqlParserError<"Unknown column in ON CONFLICT UPDATE">]
			: [R1, Db, SqlParserError<"Expected column name in ON CONFLICT UPDATE">]
		: never

type ParseInsertAfterUpsertSet<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	UpsertScope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlTableShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	SetCols extends readonly string[],
> =
	PeekToken<Tokens> extends TokenKey<"where">
		? ReadToken<Tokens> extends [infer Rw0 extends TokensList, TokenKey<"where">]
			? ParseWhereExpression<Rw0, Db, UpsertScope, Params> extends [infer Rw extends TokensList, infer We]
				? We extends SqlParserError<string>
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
	Tbl extends JsqlTableShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	UpsertCols extends readonly string[] | undefined,
	Returning extends JsqlSelectStatementResult | undefined,
> =
	PeekToken<Tokens> extends TokenKey<"returning">
		? ReadToken<Tokens> extends [infer Rr extends TokensList, TokenKey<"returning">]
			? ParseAndResolveReturningClause<Rr, Db, Scope, Params> extends [
					infer Ra extends TokensList,
					infer DbA extends JsqlDatabaseShape,
					infer Ret,
				]
				? Ret extends SqlParserError<string>
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
	ReadToken<Tokens> extends [infer AfterSemi extends TokensList, infer Tok]
		? Tok extends TokenKey<";"> | TokenEot
			? [AfterSemi, Db, Res]
			: [AfterSemi, Db, SqlParserError<"Expected `;` after INSERT">]
		: never

type ParseInsertAfterInto<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
> =
	ParseInsertFromTableRef<Tokens, Db, Params> extends [infer R extends TokensList, infer Mid, infer Third]
		? Mid extends SqlParserError<string>
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
		: [Tokens, Db, SqlParserError<"Expected INTO after INSERT">]
