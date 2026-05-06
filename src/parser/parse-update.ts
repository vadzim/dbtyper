import type {
	JsqlDatabaseShape,
	JsqlDataShape,
	JsqlUpdateStatementResult,
	JsqlSelectStatementResult,
} from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { MergeScope, ScopeMap } from "./parser-scope.ts"
import type { EmptyExpressionParams, ExprAtom, ExpressionParamsShape, ParseAddValue } from "./parse-expression.ts"
import type { ParseWhereExpression } from "./parse-where-expression.ts"
import type { JsqlDbGetData, JsqlDbGetColumnType } from "../core/jsql-utils.ts"
import type { SqlTypesOf } from "./parser-sql-types-of.ts"
import type { ValidateMutationValueForColumn } from "./parser-validate-mutation-value.ts"
import type { ParseAndResolveReturningClause } from "./parse-select.ts"

type UpdateTableContext = {
	scope: ScopeMap
	tbl: JsqlDataShape
	schema: string
	table: string
}

type ParseUpdateAliasAfterTable<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape,
> =
	PeekToken<Tokens> extends TokenKey<"set">
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
					? PeekToken<Ra> extends TokenKey<"set">
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
						: [Ra, SqlParserError<"Expected SET after table in UPDATE">, ParserRefErrorThirdSentinel]
					: [Ra, SqlParserError<"Expected SET after table in UPDATE">, ParserRefErrorThirdSentinel]
				: never
			: never

type ParseUpdateFromTableRef<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
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
													SqlParserError<"Unknown schema or table in UPDATE">,
													ParserRefErrorThirdSentinel,
												]
											: TblTry extends JsqlDataShape
												? ParseUpdateAliasAfterTable<R3, Db, A, B, TblTry>
												: [
														R3,
														SqlParserError<"Unknown schema or table in UPDATE">,
														ParserRefErrorThirdSentinel,
													]
										: never
									: [
											R3,
											SqlParserError<"Expected table name after `.` in UPDATE">,
											ParserRefErrorThirdSentinel,
										]
								: never
							: never
						: never
					: JsqlDbGetData<Db, Db["defaultSchema"], A> extends infer TblTry
						? [TblTry] extends [never]
							? [R1, SqlParserError<"Unknown table in UPDATE">, ParserRefErrorThirdSentinel]
							: TblTry extends JsqlDataShape
								? ParseUpdateAliasAfterTable<R1, Db, Db["defaultSchema"], A, TblTry>
								: [R1, SqlParserError<"Unknown table in UPDATE">, ParserRefErrorThirdSentinel]
						: never
				: [R1, SqlParserError<"Expected table name in UPDATE">, ParserRefErrorThirdSentinel]
			: never
		: never

type ParseUpdateSetAssignments<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Acc extends readonly string[],
> =
	PeekToken<Tokens> extends infer TokCol
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? TokCol extends TokenIdent<infer Col extends string>
				? JsqlDbGetColumnType<Db, Sch, Tab, Col> extends null
					? [R1, Db, SqlParserError<"Unknown column in UPDATE SET">]
					: PeekToken<R1> extends TokenKey<"=">
						? SkipToken<R1> extends infer R2 extends TokensList
							? ParseAddValue<R2, Db, Scope, Params> extends [infer R3 extends TokensList, infer Ev]
								? Ev extends SqlParserError<string>
									? [R3, Db, Ev]
									: Ev extends ExprAtom
										? ValidateMutationValueForColumn<Tbl, Col, Ev> extends infer V0
											? V0 extends SqlParserError<string>
												? [R3, Db, V0]
												: V0 extends true
													? PeekToken<R3> extends TokenKey<",">
														? SkipToken<R3> extends infer R4 extends TokensList
															? ParseUpdateSetAssignments<
																	R4,
																	Db,
																	Scope,
																	Params,
																	Tbl,
																	Sch,
																	Tab,
																	readonly [...Acc, Col]
																>
															: never
														: PeekToken<R3> extends
																	| TokenKey<"from">
																	| TokenKey<"where">
																	| TokenKey<"returning">
																	| TokenKey<";">
																	| TokenEot
															? [
																	R3,
																	Db,
																	{
																		kind: "update"
																		table: Tab
																		schema: Sch
																		set_columns: readonly [...Acc, Col]
																	},
																]
															: [
																	R3,
																	Db,
																	SqlParserError<"Expected `,`, FROM, WHERE, or end after UPDATE assignment">,
																]
													: never
											: never
										: [R3, Db, SqlParserError<"Invalid value expression in UPDATE">]
								: never
							: never
						: [R1, Db, SqlParserError<"Expected `=` after column in UPDATE SET">]
				: [R1, Db, SqlParserError<"Expected column name in UPDATE SET">]
			: never
		: never

type ParseUpdateAfterSetKeyword<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
> =
	PeekToken<Tokens> extends TokenKey<"set">
		? SkipToken<Tokens> extends infer Rs extends TokensList
			? ParseUpdateSetAssignments<Rs, Db, Scope, Params, Tbl, Sch, Tab, readonly []>
			: never
		: [Tokens, Db, SqlParserError<"Expected SET in UPDATE">]

type ParseUpdateFromClause<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Res extends JsqlUpdateStatementResult,
> =
	ParseUpdateFromClauseTableRef<Tokens, Db, Scope, Params> extends [
		infer RFrom extends TokensList,
		infer FromErr,
		infer FromScope,
	]
		? FromErr extends SqlParserError<string>
			? [RFrom, Db, FromErr]
			: FromScope extends ScopeMap
				? MergeScope<Scope, FromScope> extends infer MergedScope
					? MergedScope extends ScopeMap
						? PeekToken<RFrom> extends TokenKey<"where">
							? SkipToken<RFrom> extends infer Rw0 extends TokensList
								? ParseWhereExpression<Rw0, Db, MergedScope, Params> extends [
										infer Rw extends TokensList,
										infer We,
									]
									? We extends SqlParserError<string>
										? [Rw, Db, We]
										: FinishUpdateReturning<Rw, Db, MergedScope, Params, Res>
									: never
								: never
							: FinishUpdateReturning<RFrom, Db, MergedScope, Params, Res>
						: never
					: never
				: never
		: never

type ParseUpdateFromClauseTableRef<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
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
													SqlParserError<"Unknown schema or table in UPDATE FROM">,
													ParserRefErrorThirdSentinel,
												]
											: TblTry extends JsqlDataShape
												? ParseUpdateFromClauseTableAlias<R3, A, B, TblTry>
												: [
														R3,
														SqlParserError<"Invalid table in UPDATE FROM">,
														ParserRefErrorThirdSentinel,
													]
										: never
									: [
											R3,
											SqlParserError<"Expected table name in UPDATE FROM">,
											ParserRefErrorThirdSentinel,
										]
								: never
							: never
						: never
					: JsqlDbGetData<Db, Db["defaultSchema"], A> extends infer TblTry2
						? [TblTry2] extends [never]
							? [R1, SqlParserError<"Unknown table in UPDATE FROM">, ParserRefErrorThirdSentinel]
							: TblTry2 extends JsqlDataShape
								? ParseUpdateFromClauseTableAlias<R1, Db["defaultSchema"], A, TblTry2>
								: [R1, SqlParserError<"Invalid table in UPDATE FROM">, ParserRefErrorThirdSentinel]
						: never
				: [R1, SqlParserError<"Expected table name in UPDATE FROM">, ParserRefErrorThirdSentinel]
			: never
		: never

type ParseUpdateFromClauseTableAlias<
	Tokens extends TokensList,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape,
> =
	PeekToken<Tokens> extends TokenKey<"where"> | TokenKey<"returning"> | TokenKey<";"> | TokenEot
		? [
				Tokens,
				null,
				MergeScope<
					Record<
						Tab,
						{
							schema: Sch
							table: Tab
							columns: Tbl["columns"]
						}
					>,
					{}
				>,
			]
		: PeekToken<Tokens> extends infer TokAlias
			? SkipToken<Tokens> extends infer Ra extends TokensList
				? TokAlias extends TokenIdent<infer Alias extends string>
					? [
							Ra,
							null,
							MergeScope<
								Record<
									Alias,
									{
										schema: Sch
										table: Tab
										columns: Tbl["columns"]
									}
								>,
								{}
							>,
						]
					: [
							Ra,
							null,
							MergeScope<
								Record<
									Tab,
									{
										schema: Sch
										table: Tab
										columns: Tbl["columns"]
									}
								>,
								{}
							>,
						]
				: never
			: never

type FinishUpdateStatement<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Res extends JsqlUpdateStatementResult,
> =
	PeekToken<Tokens> extends TokenKey<"from">
		? SkipToken<Tokens> extends infer Rf extends TokensList
			? ParseUpdateFromClause<Rf, Db, Scope, Params, Res>
			: never
		: PeekToken<Tokens> extends TokenKey<"where">
			? SkipToken<Tokens> extends infer Rw0 extends TokensList
				? ParseWhereExpression<Rw0, Db, Scope, Params> extends [infer Rw extends TokensList, infer We]
					? We extends SqlParserError<string>
						? [Rw, Db, We]
						: FinishUpdateReturning<Rw, Db, Scope, Params, Res>
					: never
				: never
			: FinishUpdateReturning<Tokens, Db, Scope, Params, Res>

type FinishUpdateReturning<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Res extends JsqlUpdateStatementResult,
> =
	PeekToken<Tokens> extends TokenKey<"returning">
		? SkipToken<Tokens> extends infer Rr extends TokensList
			? ParseAndResolveReturningClause<Rr, Db, Scope, Params> extends [
					infer Ra extends TokensList,
					infer DbA extends JsqlDatabaseShape,
					infer Ret,
				]
				? Ret extends SqlParserError<string>
					? [Ra, DbA, Ret]
					: Ret extends JsqlSelectStatementResult
						? FinishUpdateSemicolon<Ra, DbA, Res, Ret>
						: never
				: never
			: never
		: FinishUpdateSemicolon<Tokens, Db, Res, null>

type FinishUpdateSemicolon<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Res extends JsqlUpdateStatementResult,
	Returning extends JsqlSelectStatementResult | null,
> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, Db, Returning extends null ? Res : Returning]
		: [Tokens, Db, SqlParserError<"Expected `;` after UPDATE">]

type ParseUpdateAfterTableRef<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
> =
	ParseUpdateFromTableRef<Tokens, Db> extends [infer R extends TokensList, infer Mid, infer Third]
		? Mid extends SqlParserError<string>
			? Third extends ParserRefErrorThirdSentinel
				? [R, Db, Mid]
				: never
			: Mid extends null
				? Third extends UpdateTableContext
					? ParseUpdateAfterSetKeyword<
							R,
							Db,
							Third["scope"],
							Params,
							Third["tbl"],
							Third["schema"],
							Third["table"]
						> extends [infer R2 extends TokensList, infer Db2 extends JsqlDatabaseShape, infer Out]
						? Out extends SqlParserError<string>
							? [R2, Db2, Out]
							: Out extends JsqlUpdateStatementResult
								? FinishUpdateStatement<R2, Db2, Third["scope"], Params, Out>
								: never
						: never
					: never
				: never
		: never

export type ParseUpdate<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = ParseUpdateAfterTableRef<Tokens, Db, Params>
