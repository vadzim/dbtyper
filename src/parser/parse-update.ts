import type { JsqlDatabaseShape, JsqlTableShape, JsqlUpdateStatementResult } from "../../core/jsql-shapes.ts"
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
import type { EmptyExpressionParams, ExprAtom, ExpressionParamsShape, ParseAddValue } from "./parse-expression.ts"
import type { ParseWhereExpression } from "./parse-where-expression.ts"
import type { ResolveTableShape } from "./resolve-table-shape.ts"
import type { SqlTypesOf, ValidateMutationValueForColumn } from "./parse-insert.ts"

type UpdateTableContext = {
	scope: ScopeMap
	tbl: JsqlTableShape
	schema: string
	table: string
}

type ParseUpdateAliasAfterTable<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
> =
	PeekToken<Tokens> extends TokenKey<"set">
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
				? PeekToken<Ra> extends TokenKey<"set">
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
					: [Ra, SqlParserError<"Expected SET after table in UPDATE">, ParserRefErrorThirdSentinel]
				: [Ra, SqlParserError<"Expected SET after table in UPDATE">, ParserRefErrorThirdSentinel]
			: never

type ParseUpdateFromTableRef<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
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
											SqlParserError<"Unknown schema or table in UPDATE">,
											ParserRefErrorThirdSentinel,
										]
									: TblTry extends JsqlTableShape
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
				: ResolveTableShape<Db, Db["defaultSchema"], A> extends infer TblTry
					? [TblTry] extends [never]
						? [R1, SqlParserError<"Unknown table in UPDATE">, ParserRefErrorThirdSentinel]
						: TblTry extends JsqlTableShape
							? ParseUpdateAliasAfterTable<R1, Db, Db["defaultSchema"], A, TblTry>
							: [R1, SqlParserError<"Unknown table in UPDATE">, ParserRefErrorThirdSentinel]
					: never
			: [R1, SqlParserError<"Expected table name in UPDATE">, ParserRefErrorThirdSentinel]
		: never

type ParseUpdateSetAssignments<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlTableShape,
	Sch extends string,
	Tab extends string,
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
													: PeekToken<R3> extends TokenKey<"where"> | TokenKey<";"> | TokenEot
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
																SqlParserError<"Expected `,`, WHERE, or end after UPDATE assignment">,
															]
												: never
										: never
									: [R3, Db, SqlParserError<"Invalid value expression in UPDATE">]
							: never
						: never
					: [R1, Db, SqlParserError<"Expected `=` after column in UPDATE SET">]
				: [R1, Db, SqlParserError<"Unknown column in UPDATE SET">]
			: [R1, Db, SqlParserError<"Expected column name in UPDATE SET">]
		: never

type ParseUpdateAfterSetKeyword<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlTableShape,
	Sch extends string,
	Tab extends string,
> =
	PeekToken<Tokens> extends TokenKey<"set">
		? ReadToken<Tokens> extends [infer Rs extends TokensList, TokenKey<"set">]
			? ParseUpdateSetAssignments<Rs, Db, Scope, Params, Tbl, Sch, Tab, readonly []>
			: never
		: [Tokens, Db, SqlParserError<"Expected SET in UPDATE">]

type FinishUpdateStatement<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Res extends JsqlUpdateStatementResult,
> =
	PeekToken<Tokens> extends TokenKey<"where">
		? ReadToken<Tokens> extends [infer Rw0 extends TokensList, TokenKey<"where">]
			? ParseWhereExpression<Rw0, Db, Scope, Params> extends [infer Rw extends TokensList, infer We]
				? We extends SqlParserError<string>
					? [Rw, Db, We]
					: FinishUpdateSemicolon<Rw, Db, Res>
				: never
			: never
		: FinishUpdateSemicolon<Tokens, Db, Res>

type FinishUpdateSemicolon<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Res extends JsqlUpdateStatementResult,
> =
	ReadToken<Tokens> extends [infer AfterSemi extends TokensList, infer Tok]
		? Tok extends TokenKey<";"> | TokenEot
			? [AfterSemi, Db, Res]
			: [AfterSemi, Db, SqlParserError<"Expected `;` after UPDATE">]
		: never

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
