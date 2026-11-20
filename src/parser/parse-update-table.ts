import type { JsqlDatabaseShape, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { AsIdent, TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { FormatError, Errors } from "../dbtyper-error.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { MergeScope, ScopeMap, TableScopeColumns } from "./parser-scope.ts"
import type { JsqlDbGetData, UnqualifiedSchema } from "../core/jsql-utils.ts"

export type UpdateTableContext = {
	scope: ScopeMap
	tbl: JsqlDataShape
	schema: string
	table: string
}

type ParseUpdateAliasAfterTable<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape,
	AfterAs extends boolean = false,
> =
	PeekToken<Tokens> extends TokenKey<"as">
		? AfterAs extends false
			? ParseUpdateAliasAfterTable<SkipToken<Tokens>, Db, Sch, Tab, Tbl, true>
			: [
					SkipToken<Tokens>,
					FormatError<Errors["EXPECTED_SET_AFTER_TABLE_IN_UPDATE"], []>,
					ParserRefErrorThirdSentinel,
				]
		: [AfterAs, PeekToken<Tokens>] extends [false, TokenKey<"set">]
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
									columns: TableScopeColumns<Tbl>
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
					? [AfterAs, DialectFact<Db, "bareDmlAlias">, AsIdent<TokAlias>] extends [
							false,
							false,
							TokenIdent<infer BareAlias extends string>,
						]
						? [
								Ra,
								FormatError<Errors["BARE_DML_ALIAS_NEEDS_AS"], ["UPDATE", BareAlias]>,
								ParserRefErrorThirdSentinel,
							]
						: AsIdent<TokAlias> extends TokenIdent<infer Alias extends string>
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
														columns: TableScopeColumns<Tbl>
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
							: [
									Ra,
									FormatError<Errors["EXPECTED_SET_AFTER_TABLE_IN_UPDATE"], []>,
									ParserRefErrorThirdSentinel,
								]
					: never
				: never

export type ParseUpdateFromTableRef<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer Tok
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? AsIdent<Tok> extends TokenIdent<infer A extends string>
				? PeekToken<R1> extends TokenKey<".">
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? PeekToken<R2> extends infer TokB
							? SkipToken<R2> extends infer R3 extends ParserMonad
								? AsIdent<TokB> extends TokenIdent<infer B extends string>
									? JsqlDbGetData<Db, A, B> extends infer TblTry
										? [TblTry] extends [never]
											? [
													R3,
													FormatError<Errors["UNKNOWN_SCHEMA_OR_TABLE"], [A, "UPDATE"]>,
													ParserRefErrorThirdSentinel,
												]
											: TblTry extends JsqlDataShape<"view">
												? [
														R3,
														FormatError<Errors["CANNOT_WRITE_VIEW"], [B, "UPDATE"]>,
														ParserRefErrorThirdSentinel,
													]
												: TblTry extends JsqlDataShape
													? ParseUpdateAliasAfterTable<R3, Db, A, B, TblTry>
													: [
															R3,
															FormatError<
																Errors["UNKNOWN_SCHEMA_OR_TABLE"],
																[A, "UPDATE"]
															>,
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
					: JsqlDbGetData<Db, UnqualifiedSchema<Db, A>, A> extends infer TblTry
						? [TblTry] extends [never]
							? [R1, FormatError<Errors["UNKNOWN_TABLE"], [A, "UPDATE"]>, ParserRefErrorThirdSentinel]
							: TblTry extends JsqlDataShape<"view">
								? [
										R1,
										FormatError<Errors["CANNOT_WRITE_VIEW"], [A, "UPDATE"]>,
										ParserRefErrorThirdSentinel,
									]
								: TblTry extends JsqlDataShape
									? ParseUpdateAliasAfterTable<R1, Db, UnqualifiedSchema<Db, A>, A, TblTry>
									: [
											R1,
											FormatError<Errors["UNKNOWN_TABLE"], [A, "UPDATE"]>,
											ParserRefErrorThirdSentinel,
										]
						: never
				: [R1, FormatError<Errors["EXPECTED_TABLE_NAME"], ["in UPDATE"]>, ParserRefErrorThirdSentinel]
			: never
		: never

/** `[column, expression]` pairs of SET, resolved once the FROM scope is known (SQLT-42): see {@link ResolveUpdateAssignments}. */
