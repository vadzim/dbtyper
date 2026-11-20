import type { JsqlDatabaseShape, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { AsIdent, TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors } from "../dbtyper-error.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { MergeScope, ScopeMap, TableScopeColumns, VisibleColumnsOf } from "./parser-scope.ts"
import type { ExpressionParamsShape } from "./parse-expression.ts"
import type { ParseTableRef, TableRefTarget } from "./parse-table-ref.ts"

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
	AfterAs extends boolean = false,
> = AfterAs extends false
	? PeekToken<Tokens> extends TokenKey<"as">
		? ParseInsertAliasAfterTable<SkipToken<Tokens>, _Db, Sch, Tab, Tbl, _Params, true>
		: InsertTableOrAlias<Tokens, Sch, Tab, Tbl>
	: InsertAlias<Tokens, Sch, Tab, Tbl>

/** `INSERT INTO t` without an alias (a bare alias is a syntax error in both dialects; it is `AS alias`). */
type InsertTableOrAlias<Tokens extends ParserMonad, Sch extends string, Tab extends string, Tbl extends JsqlDataShape> =
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
		: SkipToken<Tokens> extends infer Ra extends ParserMonad
			? [
					Ra,
					FormatError<Errors["EXPECTED_OPEN_PAREN_COLUMN_LIST_AFTER_TABLE_IN_INSERT"], []>,
					ParserRefErrorThirdSentinel,
				]
			: never

/** The alias after `INSERT INTO t AS`. */
type InsertAlias<Tokens extends ParserMonad, Sch extends string, Tab extends string, Tbl extends JsqlDataShape> =
	PeekToken<Tokens> extends infer TokAlias
		? SkipToken<Tokens> extends infer Ra extends ParserMonad
			? AsIdent<TokAlias> extends TokenIdent<infer Alias extends string>
				? PeekToken<Ra> extends TokenKey<"(" | "values" | "select" | "default">
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
	ParseTableRef<Tokens, Db, "INSERT INTO", "INSERT"> extends [infer R extends ParserMonad, infer E, infer Target]
		? E extends null
			? Target extends TableRefTarget<
					infer Sch extends string,
					infer Tab extends string,
					infer Tbl extends JsqlDataShape
				>
				? ParseInsertAliasAfterTable<R, Db, Sch, Tab, Tbl, Params>
				: never
			: [R, E, Target]
		: never
