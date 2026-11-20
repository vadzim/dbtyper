import type { JsqlDatabaseShape, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors } from "../dbtyper-error.ts"
import type { MergeScope, ScopeMap, TableScopeColumns, VisibleColumnsOf } from "./parser-scope.ts"
import type { ExpressionParamsShape } from "./parse-expression.ts"
import type { ParseAlias } from "./parse-alias.ts"
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

type InsertAliasRow = {
	ends: TokenKey<"(" | "values" | "select" | "default">
	bare: "never"
	verb: ""
	afterAs: FormatError<Errors["EXPECTED_OPEN_PAREN_COLUMN_LIST_AFTER_TABLE_IN_INSERT"], []>
	bad: FormatError<Errors["EXPECTED_OPEN_PAREN_COLUMN_LIST_AFTER_TABLE_IN_INSERT"], []>
	tail: TokenKey<"(" | "values" | "select" | "default">
	tailError: FormatError<Errors["EXPECTED_OPEN_PAREN_COLUMN_LIST_AFTER_TABLE_IN_INSERT"], []>
}

/** `INSERT INTO t [AS alias]` (a bare alias is a syntax error in both dialects). */
type ParseInsertAliasAfterTable<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape,
	_Params extends ExpressionParamsShape,
> =
	ParseAlias<Tokens, Db, InsertAliasRow> extends [infer R extends ParserMonad, infer E, infer Alias]
		? E extends null
			? [
					R,
					null,
					{
						scope: MergeScope<
							Record<
								Alias extends string ? Alias : Tab,
								{ schema: Sch; table: Tab; columns: TableScopeColumns<Tbl> }
							>,
							{}
						>
						tbl: InsertTable<Tbl>
						schema: Sch
						table: Tab
					},
				]
			: [R, E, Alias]
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
