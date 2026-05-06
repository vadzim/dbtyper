import type { JsqlDatabaseShape, JsqlDataShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { MergeScope, ScopeMap } from "./parser-scope.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "./parse-expression.ts"
import type { JsqlDbGetSet } from "../core/jsql-utils.ts"
import type { ParseWhereExpression } from "./parse-where-expression.ts"
import type { ParseAndResolveReturningClause } from "./parse-select.ts"

export type ParseDelete<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends TokenKey<"from">
		? ParseDeleteAfterFrom<SkipToken<Tokens>, Db, Params>
		: [Tokens, Db, SqlParserError<"Expected FROM after DELETE">]

type ParseDeleteAfterFrom<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
> =
	ParseDeleteFromTableRef<Tokens, Db, {}, Params> extends [infer R extends TokensList, infer Mid, infer Third]
		? Mid extends SqlParserError<string>
			? Third extends ParserRefErrorThirdSentinel
				? [R, Db, Mid]
				: never
			: Mid extends null
				? Third extends ScopeMap
					? PeekToken<R> extends TokenKey<"using">
						? SkipToken<R> extends infer Ru extends TokensList
							? ParseDeleteUsingClause<Ru, Db, Third, Params>
							: never
						: PeekToken<R> extends TokenKey<"where">
							? SkipToken<R> extends infer Rw0 extends TokensList
								? ParseWhereExpression<Rw0, Db, Third, Params> extends [
										infer Rw extends TokensList,
										infer We extends SqlParserError<string> | null,
									]
									? We extends SqlParserError<string>
										? [Rw, Db, We]
										: FinishDeleteStatement<Rw, Db, Third, Params>
									: never
								: never
							: FinishDeleteStatement<R, Db, Third, Params>
					: never
				: never
		: never

type ParseDeleteUsingClause<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	ParseDeleteUsingTableRef<Tokens, Db, Scope, Params> extends [
		infer RUsing extends TokensList,
		infer UsingErr,
		infer UsingScope,
	]
		? UsingErr extends SqlParserError<string>
			? [RUsing, Db, UsingErr]
			: UsingScope extends ScopeMap
				? MergeScope<Scope, UsingScope> extends infer MergedScope
					? MergedScope extends ScopeMap
						? PeekToken<RUsing> extends TokenKey<"where">
							? SkipToken<RUsing> extends infer Rw0 extends TokensList
								? ParseWhereExpression<Rw0, Db, MergedScope, Params> extends [
										infer Rw extends TokensList,
										infer We,
									]
									? We extends SqlParserError<string>
										? [Rw, Db, We]
										: FinishDeleteStatement<Rw, Db, MergedScope, Params>
									: never
								: never
							: FinishDeleteStatement<RUsing, Db, MergedScope, Params>
						: never
					: never
				: never
		: never

type ParseDeleteUsingTableRef<
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
									? JsqlDbGetSet<Db, A, B> extends infer TblTry
										? [TblTry] extends [never]
											? [
													R3,
													SqlParserError<"Unknown schema or table in DELETE USING">,
													ParserRefErrorThirdSentinel,
												]
											: TblTry extends JsqlDataShape
												? ParseDeleteUsingTableAlias<R3, A, B, TblTry>
												: [
														R3,
														SqlParserError<"Invalid table in DELETE USING">,
														ParserRefErrorThirdSentinel,
													]
										: never
									: [
											R3,
											SqlParserError<"Expected table name in DELETE USING">,
											ParserRefErrorThirdSentinel,
										]
								: never
							: never
						: never
					: JsqlDbGetSet<Db, Db["defaultSchema"], A> extends infer TblTry2
						? [TblTry2] extends [never]
							? [R1, SqlParserError<"Unknown table in DELETE USING">, ParserRefErrorThirdSentinel]
							: TblTry2 extends JsqlDataShape
								? ParseDeleteUsingTableAlias<R1, Db["defaultSchema"], A, TblTry2>
								: [R1, SqlParserError<"Invalid table in DELETE USING">, ParserRefErrorThirdSentinel]
						: never
				: [R1, SqlParserError<"Expected table name in DELETE USING">, ParserRefErrorThirdSentinel]
			: never
		: never

type ParseDeleteUsingTableAlias<
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

type FinishDeleteStatement<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap = {},
	Params extends ExpressionParamsShape = EmptyExpressionParams,
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
						? FinishDeleteSemicolon<Ra, DbA, Ret>
						: never
				: never
			: never
		: FinishDeleteSemicolon<Tokens, Db, null>

type FinishDeleteSemicolon<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Returning extends JsqlSelectStatementResult | null,
> =
	PeekToken<Tokens> extends infer Tok
		? SkipToken<Tokens> extends infer AfterSemi extends TokensList
			? Tok extends TokenKey<";"> | TokenEot
				? [AfterSemi, Db, Returning]
				: [AfterSemi, Db, SqlParserError<"Expected `;` after DELETE">]
			: never
		: never

type ParseDeleteFromTableRef<
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
									? JsqlDbGetSet<Db, A, B> extends infer TblTry
										? [TblTry] extends [never]
											? [
													R3,
													SqlParserError<"Unknown schema or table in DELETE FROM">,
													ParserRefErrorThirdSentinel,
												]
											: TblTry extends JsqlDataShape
												? ParseDeleteAliasAfterTable<R3, Db, A, B, TblTry, Scope, Params>
												: [
														R3,
														SqlParserError<"Unknown schema or table in DELETE FROM">,
														ParserRefErrorThirdSentinel,
													]
										: never
									: [
											R3,
											SqlParserError<"Expected table name after `.` in DELETE FROM">,
											ParserRefErrorThirdSentinel,
										]
								: never
							: never
						: never
					: JsqlDbGetSet<Db, Db["defaultSchema"], A> extends infer TblTry
						? [TblTry] extends [never]
							? [R1, SqlParserError<"Unknown table in DELETE FROM">, ParserRefErrorThirdSentinel]
							: TblTry extends JsqlDataShape
								? ParseDeleteAliasAfterTable<R1, Db, Db["defaultSchema"], A, TblTry, Scope, Params>
								: [R1, SqlParserError<"Unknown table in DELETE FROM">, ParserRefErrorThirdSentinel]
						: never
				: [R1, SqlParserError<"Expected table name in DELETE FROM">, ParserRefErrorThirdSentinel]
			: never
		: never

type ParseDeleteAliasAfterTable<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape,
	Scope extends ScopeMap,
	_Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"using"> | TokenKey<"where"> | TokenKey<"returning"> | TokenKey<";"> | TokenEot
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
					Scope
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
								Scope
							>,
						]
					: [Ra, SqlParserError<"Expected alias or end of table in DELETE FROM">, ParserRefErrorThirdSentinel]
				: never
			: never
