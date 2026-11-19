import type { JsqlDatabaseShape, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors } from "../dbtyper-error.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { MergeScope, ScopeMap, TableScopeColumns, VisibleColumnsOf } from "./parser-scope.ts"
import type { ExpressionParamsShape } from "./parse-expression.ts"
import type { JsqlDbGetData, UnqualifiedSchema } from "../core/jsql-utils.ts"

export type InsertTableContext = {
	scope: ScopeMap
	tbl: JsqlDataShape
	schema: string
	table: string
}

/** SQLT-15: an INSERT into a SQLite table with a rowid may name `rowid`, `oid`, `_rowid_` (columns of the target, never of `*`). */
type InsertTable<Tbl extends JsqlDataShape> = Tbl extends { rowid_table: true }
	? Tbl & { columns: TableScopeColumns<Tbl> }
	: Tbl

/** The real columns of an INSERT target, in declaration order: what an INSERT without a column list fills. */
export type InsertRealColumns<Tbl extends JsqlDataShape> = VisibleColumnsOf<{
	schema: string
	table: string
	columns: Tbl["columns"]
}>

type ParseInsertAliasAfterTable<
	Tokens extends ParserMonad,
	_Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape,
	_Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"(" | "values" | "select" | "default">
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
					tbl: InsertTable<Tbl>
					schema: Sch
					table: Tab
				},
			]
		: PeekToken<Tokens> extends infer TokAlias
			? SkipToken<Tokens> extends infer Ra extends ParserMonad
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
												columns: TableScopeColumns<Tbl>
											}
										>,
										{}
									>
									tbl: InsertTable<Tbl>
									schema: Sch
									table: Tab
								},
							]
						: [
								Ra,
								FormatError<Errors["EXPECTED_OPEN_PAREN_COLUMN_LIST_AFTER_TABLE_IN_INSERT"], []>,
								ParserRefErrorThirdSentinel,
							]
					: [
							Ra,
							FormatError<Errors["EXPECTED_OPEN_PAREN_COLUMN_LIST_AFTER_TABLE_IN_INSERT"], []>,
							ParserRefErrorThirdSentinel,
						]
				: never
			: never

export type ParseInsertFromTableRef<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
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
													FormatError<Errors["UNKNOWN_SCHEMA_OR_TABLE"], [A, "INSERT INTO"]>,
													ParserRefErrorThirdSentinel,
												]
											: TblTry extends JsqlDataShape
												? ParseInsertAliasAfterTable<R3, Db, A, B, TblTry, Params>
												: [
														R3,
														FormatError<
															Errors["UNKNOWN_SCHEMA_OR_TABLE"],
															[A, "INSERT INTO"]
														>,
														ParserRefErrorThirdSentinel,
													]
										: never
									: [
											R3,
											FormatError<Errors["EXPECTED_TABLE_NAME"], ["after `.` in INSERT INTO"]>,
											ParserRefErrorThirdSentinel,
										]
								: never
							: never
						: never
					: JsqlDbGetData<Db, UnqualifiedSchema<Db, A>, A> extends infer TblTry
						? [TblTry] extends [never]
							? [
									R1,
									FormatError<Errors["UNKNOWN_TABLE"], [A, "INSERT INTO"]>,
									ParserRefErrorThirdSentinel,
								]
							: TblTry extends JsqlDataShape
								? ParseInsertAliasAfterTable<R1, Db, UnqualifiedSchema<Db, A>, A, TblTry, Params>
								: [
										R1,
										FormatError<Errors["UNKNOWN_TABLE"], [A, "INSERT INTO"]>,
										ParserRefErrorThirdSentinel,
									]
						: never
				: [R1, FormatError<Errors["EXPECTED_TABLE_NAME"], ["in INSERT INTO"]>, ParserRefErrorThirdSentinel]
			: never
		: never
