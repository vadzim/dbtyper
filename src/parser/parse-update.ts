import type {
	JsqlDatabaseShape,
	JsqlDataShape,
	JsqlUpdateStatementResult,
	JsqlSelectStatementResult,
} from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { SqlParserError, FormatError } from "../sql-parser-error.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { MergeScope, ScopeMap } from "./parser-scope.ts"
import type {
	EmptyExpressionParams,
	ExpressionParamsShape,
	ParseExpressionAST,
	ScalarExprAst,
	ResolveExpressionAST,
} from "./parse-expression.ts"
import type { ParseWhereExpression } from "./parse-where-expression.ts"
import type { JsqlDbGetData, JsqlDbGetColumnType } from "../core/jsql-utils.ts"
import type { ValidateMutationValueForColumn } from "./parser-validate-mutation-value.ts"
import type { ParseAndResolveReturningClause } from "./parse-select.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"

type UpdateTableContext = {
	scope: ScopeMap
	tbl: JsqlDataShape
	schema: string
	table: string
}

type ParseUpdateAliasAfterTable<
	Tokens extends TokensList,
	_Db extends JsqlDatabaseShape,
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
						: [Ra, FormatError<"EXPECTED_SET_AFTER_TABLE_IN_UPDATE", []>, ParserRefErrorThirdSentinel]
					: [Ra, FormatError<"EXPECTED_SET_AFTER_TABLE_IN_UPDATE", []>, ParserRefErrorThirdSentinel]
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
													FormatError<"UNKNOWN_SCHEMA_OR_TABLE_IN_UPDATE", [A, B]>,
													ParserRefErrorThirdSentinel,
												]
											: TblTry extends JsqlDataShape
												? ParseUpdateAliasAfterTable<R3, Db, A, B, TblTry>
												: [
														R3,
														FormatError<"UNKNOWN_SCHEMA_OR_TABLE_IN_UPDATE", [A, B]>,
														ParserRefErrorThirdSentinel,
													]
										: never
									: [
											R3,
											FormatError<"EXPECTED_TABLE_NAME_AFTER_DOT_IN_UPDATE", []>,
											ParserRefErrorThirdSentinel,
										]
								: never
							: never
						: never
					: JsqlDbGetData<Db, Db["defaultSchema"], A> extends infer TblTry
						? [TblTry] extends [never]
							? [R1, FormatError<"UNKNOWN_TABLE_UPDATE", [A]>, ParserRefErrorThirdSentinel]
							: TblTry extends JsqlDataShape
								? ParseUpdateAliasAfterTable<R1, Db, Db["defaultSchema"], A, TblTry>
								: [R1, FormatError<"UNKNOWN_TABLE_UPDATE", [A]>, ParserRefErrorThirdSentinel]
						: never
				: [R1, FormatError<"EXPECTED_TABLE_NAME_IN_UPDATE", []>, ParserRefErrorThirdSentinel]
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
					? [R1, Db, FormatError<"UNKNOWN_COLUMN_UPDATE_SET", [Col]>]
					: PeekToken<R1> extends TokenKey<"=">
						? SkipToken<R1> extends infer R2 extends TokensList
							? ParseExpressionAST<R2, { db: Db; params: Params; outerScope: Scope }> extends [
									infer R3 extends TokensList,
									infer Ast,
								]
								? Ast extends SqlParserError<string>
									? [R3, Db, Ast]
									: Ast extends ScalarExprAst
										? ResolveExpressionAST<Ast, Db, Scope, Params> extends infer Resolved
											? Resolved extends SqlParserError<string>
												? [R3, Db, Resolved]
												: Resolved extends SqlTypeShape
													? ValidateMutationValueForColumn<
															Tbl,
															Col,
															Resolved
														> extends infer V0
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
																				FormatError<
																					"EXPECTED_COMMA_FROM_WHERE_OR_END_AFTER_UPDATE_ASSIGNMENT",
																					[]
																				>,
																			]
																: never
														: never
													: SkipFailedExpression<
																R3,
																FormatError<"INVALID_VALUE_EXPRESSION_IN_UPDATE", []>
														  > extends [infer Rest extends TokensList, infer Err]
														? [Rest, Db, Err]
														: never
											: never
										: SkipFailedExpression<
													R3,
													FormatError<"INVALID_VALUE_EXPRESSION_IN_UPDATE", []>
											  > extends [infer Rest extends TokensList, infer Err]
											? [Rest, Db, Err]
											: never
								: never
							: never
						: SkipFailedStatement<R1, Db, FormatError<"EXPECTED_EQUALS_AFTER_COLUMN_IN_UPDATE_SET", []>>
				: SkipFailedStatement<R1, Db, FormatError<"EXPECTED_COLUMN_NAME_IN_UPDATE_SET", []>>
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
		: SkipFailedStatement<Tokens, Db, FormatError<"EXPECTED_SET_IN_UPDATE", []>>

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
	_Scope extends ScopeMap,
	_Params extends ExpressionParamsShape,
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
													FormatError<"UNKNOWN_SCHEMA_OR_TABLE_IN_UPDATE_FROM", [A, B]>,
													ParserRefErrorThirdSentinel,
												]
											: TblTry extends JsqlDataShape
												? ParseUpdateFromClauseTableAlias<R3, A, B, TblTry>
												: [
														R3,
														FormatError<"INVALID_TABLE_IN_UPDATE_FROM", []>,
														ParserRefErrorThirdSentinel,
													]
										: never
									: [
											R3,
											FormatError<"EXPECTED_TABLE_NAME_IN_UPDATE_FROM", []>,
											ParserRefErrorThirdSentinel,
										]
								: never
							: never
						: never
					: JsqlDbGetData<Db, Db["defaultSchema"], A> extends infer TblTry2
						? [TblTry2] extends [never]
							? [R1, FormatError<"UNKNOWN_TABLE_IN_UPDATE_FROM", [A]>, ParserRefErrorThirdSentinel]
							: TblTry2 extends JsqlDataShape
								? ParseUpdateFromClauseTableAlias<R1, Db["defaultSchema"], A, TblTry2>
								: [R1, FormatError<"INVALID_TABLE_IN_UPDATE_FROM", []>, ParserRefErrorThirdSentinel]
						: never
				: [R1, FormatError<"EXPECTED_TABLE_NAME_IN_UPDATE_FROM", []>, ParserRefErrorThirdSentinel]
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
		: SkipFailedStatement<Tokens, Db, FormatError<"EXPECTED_SEMICOLON_AFTER_UPDATE", []>>

type ParseUpdateAfterTableRef<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
> =
	ParseUpdateFromTableRef<Tokens, Db> extends [infer R extends TokensList, infer Mid, infer Third]
		? Mid extends SqlParserError<string>
			? Third extends ParserRefErrorThirdSentinel
				? SkipFailedStatement<R, Db, Mid>
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
