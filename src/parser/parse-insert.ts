import type { JsqlColumnFactsMap, JsqlDatabaseShape, JsqlInsertStatementResult, JsqlTableShape } from "../../core/jsql-shapes.ts"
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
import type { ResolveTableShape } from "./resolve-table-shape.ts"

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
					: [Ra, SqlParserError<"Expected `(` (column list) after table in INSERT">, ParserRefErrorThirdSentinel]
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

type ParseInsertColumnNameList<
	Tokens extends TokensList,
	Tbl extends JsqlTableShape,
	Acc extends readonly string[],
> = PeekToken<Tokens> extends TokenKey<")">
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
> = ReadToken<Tokens> extends [infer R0 extends TokensList, TokenKey<"(">]
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
> = ReadToken<R1> extends [infer Rv extends TokensList, infer TkValues]
	? TkValues extends TokenKey<"values">
		? ParseInsertAfterValuesKeyword<Rv, Db, Scope, Params, Tbl, Sch, Tab, Cols>
		: [Rv, Db, SqlParserError<"Expected VALUES after column list in INSERT">]
	: never

type ParseInsertAfterValuesKeyword<
	Rv extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlTableShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> = ReadToken<Rv> extends [infer Rvals extends TokensList, infer TkOpen]
	? TkOpen extends TokenKey<"(">
		? ParseInsertValuesCells<Rvals, Db, Scope, Params, Tbl, Sch, Tab, Cols> extends [
				infer Rf extends TokensList,
				infer Db2 extends JsqlDatabaseShape,
				infer Res,
			]
			? Res extends SqlParserError<string>
				? [Rf, Db2, Res]
				: Res extends JsqlInsertStatementResult
					? FinishInsertSemicolon<Rf, Db2, Res>
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
										? PeekToken<R2> extends TokenKey<",">
											? [R2, Db, SqlParserError<"Multiple INSERT VALUES rows are not supported">]
											: [
													R2,
													Db,
													{
														kind: "insert"
														table: Tab
														schema: Sch
														columns: Cols
													},
												]
											: [R2, Db, SqlParserError<"Expected `)` after INSERT values">]
									: never
								: ParseInsertValuesCommaThenRest<R1, Db, Scope, Params, Tbl, Sch, Tab, CR, Cols>
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
> = PeekToken<Tokens> extends TokenKey<",">
	? ReadToken<Tokens> extends [infer Rc extends TokensList, TokenKey<",">]
		? ParseInsertValuesCells<Rc, Db, Scope, Params, Tbl, Sch, Tab, CR>
		: never
	: [Tokens, Db, SqlParserError<"Expected `,` between INSERT values">]

type FinishInsertSemicolon<Tokens extends TokensList, Db extends JsqlDatabaseShape, Res extends JsqlInsertStatementResult> =
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
