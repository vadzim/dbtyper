import type { JsqlDatabaseShape, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors } from "../dbtyper-error.ts"
import type { ParseAlias } from "./parse-alias.ts"
import type { IndexNamesOf } from "./parse-index.ts"
import type { ParseTableRef, TableRefTarget } from "./parse-table-ref.ts"
import type { MergeScope, ScopeMap, TableScopeColumns } from "./parser-scope.ts"

export type UpdateTableContext = {
	scope: ScopeMap
	tbl: JsqlDataShape
	schema: string
	table: string
}

type UpdateAliasRow = {
	ends: TokenKey<"set">
	bare: "dml"
	verb: "UPDATE"
	afterAs: FormatError<Errors["EXPECTED_SET_AFTER_TABLE_IN_UPDATE"], []>
	bad: FormatError<Errors["EXPECTED_SET_AFTER_TABLE_IN_UPDATE"], []>
	tail: TokenKey<"set">
	tailError: FormatError<Errors["EXPECTED_SET_AFTER_TABLE_IN_UPDATE"], []>
}

/** `UPDATE t [[AS] alias] [INDEXED BY i | NOT INDEXED] SET`: on SQLite the alias needs AS (`bareDmlAlias`). */
type ParseUpdateAliasAfterTable<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape,
> =
	ParseAlias<Tokens, Db, UpdateAliasRow, { table: Tab; indexes: IndexNamesOf<Tbl> }> extends [
		infer R extends ParserMonad,
		infer E,
		infer Alias,
	]
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
						tbl: Tbl
						schema: Sch
						table: Tab
					},
				]
			: [R, E, Alias]
		: never

export type ParseUpdateFromTableRef<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	ParseTableRef<Tokens, Db, "UPDATE", "UPDATE"> extends [infer R extends ParserMonad, infer E, infer Target]
		? E extends null
			? Target extends TableRefTarget<
					infer Sch extends string,
					infer Tab extends string,
					infer Tbl extends JsqlDataShape
				>
				? ParseUpdateAliasAfterTable<R, Db, Sch, Tab, Tbl>
				: never
			: [R, E, Target]
		: never

/** `[column, expression]` pairs of SET, resolved once the FROM scope is known (SQLT-42): see {@link ResolveUpdateAssignments}. */
