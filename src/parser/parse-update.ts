import type {
	JsqlDatabaseShape,
	JsqlDataShape,
	JsqlUpdateStatementResult,
	JsqlSelectStatementResult,
} from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
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
	Tokens extends ParserMonad,
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
			? SkipToken<Tokens> extends infer Ra extends ParserMonad
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
						: [
								Ra,
								FormatError<Errors["EXPECTED_SET_AFTER_TABLE_IN_UPDATE"], []>,
								ParserRefErrorThirdSentinel,
							]
					: [Ra, FormatError<Errors["EXPECTED_SET_AFTER_TABLE_IN_UPDATE"], []>, ParserRefErrorThirdSentinel]
				: never
			: never

type ParseUpdateFromTableRef<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer Tok
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? Tok extends TokenIdent<infer A extends string>
				? PeekToken<R1> extends TokenKey<".">
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? PeekToken<R2> extends infer TokB
							? SkipToken<R2> extends infer R3 extends ParserMonad
								? TokB extends TokenIdent<infer B extends string>
									? JsqlDbGetData<Db, A, B> extends infer TblTry
										? [TblTry] extends [never]
											? [
													R3,
													FormatError<Errors["UNKNOWN_SCHEMA_OR_TABLE"], [A, "UPDATE"]>,
													ParserRefErrorThirdSentinel,
												]
											: TblTry extends JsqlDataShape
												? ParseUpdateAliasAfterTable<R3, Db, A, B, TblTry>
												: [
														R3,
														FormatError<Errors["UNKNOWN_SCHEMA_OR_TABLE"], [A, "UPDATE"]>,
														ParserRefErrorThirdSentinel,
													]
										: never
									: [
											R3,
											FormatError<Errors["EXPECTED_TABLE_NAME"], ["after `.` in UPDATE"]>,
											ParserRefErrorThirdSentinel,
										]
								: never
							: never
						: never
					: JsqlDbGetData<Db, Db["defaultSchema"], A> extends infer TblTry
						? [TblTry] extends [never]
							? [R1, FormatError<Errors["UNKNOWN_TABLE"], [A, "UPDATE"]>, ParserRefErrorThirdSentinel]
							: TblTry extends JsqlDataShape
								? ParseUpdateAliasAfterTable<R1, Db, Db["defaultSchema"], A, TblTry>
								: [R1, FormatError<Errors["UNKNOWN_TABLE"], [A, "UPDATE"]>, ParserRefErrorThirdSentinel]
						: never
				: [R1, FormatError<Errors["EXPECTED_TABLE_NAME"], ["in UPDATE"]>, ParserRefErrorThirdSentinel]
			: never
		: never

type ParseUpdateSetAssignments<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Acc extends readonly string[],
	PositionalParamIndex extends number = 0,
> =
	PeekToken<Tokens> extends infer TokCol
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? TokCol extends TokenIdent<infer Col extends string>
				? JsqlDbGetColumnType<Db, Sch, Tab, Col> extends null
					? [R1, Db, FormatError<Errors["UNKNOWN_COLUMN"], [Col, "UPDATE SET"]>]
					: PeekToken<R1> extends TokenKey<"=">
						? SkipToken<R1> extends infer R2 extends ParserMonad
							? ParseExpressionAST<
									R2,
									{
										db: Db
										params: Params
										outerScope: Scope
										positionalParamIndex: PositionalParamIndex
									}
								> extends [
									infer R3 extends ParserMonad,
									infer Ast,
									infer UpdatedEnv extends import("./parse-expression.ts").ExprParseEnv,
								]
								? Ast extends DbtyperErrorShape
									? [R3, Db, Ast]
									: Ast extends ScalarExprAst
										? ResolveExpressionAST<Ast, Db, Scope, Params> extends infer Resolved
											? Resolved extends DbtyperErrorShape
												? [R3, Db, Resolved]
												: Resolved extends SqlTypeShape
													? ValidateMutationValueForColumn<
															Tbl,
															Col,
															Resolved
														> extends infer V0
														? V0 extends DbtyperErrorShape
															? [R3, Db, V0]
															: V0 extends true
																? PeekToken<R3> extends TokenKey<",">
																	? SkipToken<R3> extends infer R4 extends ParserMonad
																		? ParseUpdateSetAssignments<
																				R4,
																				Db,
																				Scope,
																				Params,
																				Tbl,
																				Sch,
																				Tab,
																				readonly [...Acc, Col],
																				UpdatedEnv["positionalParamIndex"]
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
																					Errors["EXPECTED_COMMA_FROM_WHERE_OR_END_AFTER_UPDATE_ASSIGNMENT"],
																					[]
																				>,
																			]
																: never
														: never
													: SkipFailedExpression<R3, never> extends [
																infer Rest extends ParserMonad,
																infer Err,
														  ]
														? [Rest, Db, Err]
														: never
											: never
										: SkipFailedExpression<R3, never> extends [
													infer Rest extends ParserMonad,
													infer Err,
											  ]
											? [Rest, Db, Err]
											: never
								: never
							: never
						: SkipFailedStatement<
								R1,
								Db,
								FormatError<Errors["EXPECTED_EQUALS_AFTER_COLUMN_IN_UPDATE_SET"], []>
							>
				: SkipFailedStatement<R1, Db, FormatError<Errors["EXPECTED_COLUMN_NAME"], ["in UPDATE SET"]>>
			: never
		: never

type ParseUpdateAfterSetKeyword<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
> =
	PeekToken<Tokens> extends TokenKey<"set">
		? ParseUpdateSetAssignments<SkipToken<Tokens>, Db, Scope, Params, Tbl, Sch, Tab, readonly []>
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_SET_IN_UPDATE"], []>>

type ParseUpdateFromClause<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Res extends JsqlUpdateStatementResult,
> =
	ParseUpdateFromClauseTableRef<Tokens, Db, Scope, Params> extends [
		infer RFrom extends ParserMonad,
		infer FromErr,
		infer FromScope,
	]
		? FromErr extends DbtyperErrorShape
			? [RFrom, Db, FromErr]
			: FromScope extends ScopeMap
				? MergeScope<Scope, FromScope> extends infer MergedScope
					? MergedScope extends ScopeMap
						? PeekToken<RFrom> extends TokenKey<"where">
							? SkipToken<RFrom> extends infer Rw0 extends ParserMonad
								? ParseWhereExpression<Rw0, Db, MergedScope, Params> extends [
										infer Rw extends ParserMonad,
										infer We,
									]
									? We extends DbtyperErrorShape
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
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	_Scope extends ScopeMap,
	_Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends infer Tok
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? Tok extends TokenIdent<infer A extends string>
				? PeekToken<R1> extends TokenKey<".">
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? PeekToken<R2> extends infer TokB
							? SkipToken<R2> extends infer R3 extends ParserMonad
								? TokB extends TokenIdent<infer B extends string>
									? JsqlDbGetData<Db, A, B> extends infer TblTry
										? [TblTry] extends [never]
											? [
													R3,
													FormatError<Errors["UNKNOWN_SCHEMA_OR_TABLE"], [A, "UPDATE FROM"]>,
													ParserRefErrorThirdSentinel,
												]
											: TblTry extends JsqlDataShape
												? ParseUpdateFromClauseTableAlias<R3, A, B, TblTry>
												: [
														R3,
														FormatError<
															Errors["UNKNOWN_SCHEMA_OR_TABLE"],
															[A, "UPDATE FROM"]
														>,
														ParserRefErrorThirdSentinel,
													]
										: never
									: [
											R3,
											FormatError<Errors["EXPECTED_TABLE_NAME"], ["in UPDATE FROM"]>,
											ParserRefErrorThirdSentinel,
										]
								: never
							: never
						: never
					: JsqlDbGetData<Db, Db["defaultSchema"], A> extends infer TblTry2
						? [TblTry2] extends [never]
							? [
									R1,
									FormatError<Errors["UNKNOWN_TABLE"], [A, "UPDATE FROM"]>,
									ParserRefErrorThirdSentinel,
								]
							: TblTry2 extends JsqlDataShape
								? ParseUpdateFromClauseTableAlias<R1, Db["defaultSchema"], A, TblTry2>
								: [R1, never, ParserRefErrorThirdSentinel]
						: never
				: [R1, FormatError<Errors["EXPECTED_TABLE_NAME"], ["in UPDATE FROM"]>, ParserRefErrorThirdSentinel]
			: never
		: never

type ParseUpdateFromClauseTableAlias<
	Tokens extends ParserMonad,
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
			? SkipToken<Tokens> extends infer Ra extends ParserMonad
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
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Res extends JsqlUpdateStatementResult,
> =
	PeekToken<Tokens> extends TokenKey<"from">
		? ParseUpdateFromClause<SkipToken<Tokens>, Db, Scope, Params, Res>
		: PeekToken<Tokens> extends TokenKey<"where">
			? SkipToken<Tokens> extends infer Rw0 extends ParserMonad
				? ParseWhereExpression<Rw0, Db, Scope, Params> extends [infer Rw extends ParserMonad, infer We]
					? We extends DbtyperErrorShape
						? [Rw, Db, We]
						: FinishUpdateReturning<Rw, Db, Scope, Params, Res>
					: never
				: never
			: FinishUpdateReturning<Tokens, Db, Scope, Params, Res>

type FinishUpdateReturning<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Res extends JsqlUpdateStatementResult,
> =
	PeekToken<Tokens> extends TokenKey<"returning">
		? SkipToken<Tokens> extends infer Rr extends ParserMonad
			? ParseAndResolveReturningClause<Rr, Db, Scope, Params> extends [
					infer Ra extends ParserMonad,
					infer DbA extends JsqlDatabaseShape,
					infer Ret,
				]
				? Ret extends DbtyperErrorShape
					? [Ra, DbA, Ret]
					: Ret extends JsqlSelectStatementResult
						? FinishUpdateSemicolon<Ra, DbA, Res, Ret>
						: never
				: never
			: never
		: FinishUpdateSemicolon<Tokens, Db, Res, null>

type FinishUpdateSemicolon<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Res extends JsqlUpdateStatementResult,
	Returning extends JsqlSelectStatementResult | null,
> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, Db, Returning extends null ? Res : Returning]
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_SEMICOLON"], ["UPDATE"]>>

type ParseUpdateAfterTableRef<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
> =
	ParseUpdateFromTableRef<Tokens, Db> extends [infer R extends ParserMonad, infer Mid, infer Third]
		? Mid extends DbtyperErrorShape
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
						> extends [infer R2 extends ParserMonad, infer Db2 extends JsqlDatabaseShape, infer Out]
						? Out extends DbtyperErrorShape
							? [R2, Db2, Out]
							: Out extends JsqlUpdateStatementResult
								? FinishUpdateStatement<R2, Db2, Third["scope"], Params, Out>
								: never
						: never
					: never
				: never
		: never

export type ParseUpdate<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = ParseUpdateAfterTableRef<Tokens, Db, Params>
