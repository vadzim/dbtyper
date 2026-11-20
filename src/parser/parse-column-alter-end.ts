import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors } from "../dbtyper-error.ts"
import type { DialectFact } from "../core/dialect.ts"
import type {
	JsqlDbGetTable,
	JsqlDbReplaceColumn,
	JsqlDbSetPrimaryKey,
	JsqlPrimaryKey,
	JsqlTablePrimaryKey,
} from "../core/jsql-utils.ts"
import type { MultiplePrimaryKeys } from "./parse-create-table.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { FinishAlterStatement, ParseAlterActions } from "./parse-alter-table.ts"
import type { OneCol } from "./parse-create-table-merge.ts"
import type { ColumnEntry, ColumnFail } from "./parse-column-constraint-clauses.ts"
import type { ColumnCtx, ColumnState } from "./parse-column-constraints.ts"

/**
 * `ALTER TABLE … ADD COLUMN <definition>` of a SQLite chain ends here (SQLT-20, SQLT-21): NOT NULL needs a default;
 * the column joins the table with the facts a CREATE TABLE gives it.
 */
export type AlterColumnDone<
	Tokens extends ParserMonad,
	C extends ColumnCtx,
	S extends ColumnState,
> = S["nn"] extends true
	? [S["def"], FullAddColumn<C>] extends [false, never]
		? ColumnFail<
				Tokens,
				C,
				FormatError<Errors["SQLITE_ADD_COLUMN_RESTRICTED"], ["NOT NULL without a non-null DEFAULT"]>
			>
		: AlterColumnStore<Tokens, C, S>
	: AlterColumnStore<Tokens, C, S>

type AlterColumnStore<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> = [
	S["pk"],
	JsqlTablePrimaryKey<JsqlDbGetTable<C["db"], C["schema"], C["table"]>>,
] extends ["single", JsqlPrimaryKey]
	? MultiplePrimaryKeys<Tokens, C["db"], C["table"]>
	: OneCol<ColumnEntry<C, S>> extends { cols: infer Cols; facts: infer Facts }
		? AlterColumnFinish<
				Tokens,
				C,
				JsqlDbReplaceColumn<
					S["pk"] extends false
						? C["db"]
						: JsqlDbSetPrimaryKey<
								C["db"],
								C["schema"],
								C["table"],
								{ columns: C["name"]; name: `${C["table"]}_pkey` }
							>,
					C["schema"],
					C["table"],
					C["name"],
					{
						type: C["name"] extends keyof Cols ? Cols[C["name"]] & SqlTypeShape : SqlTypeShape
					} & (C["name"] extends keyof Facts ? Facts[C["name"]] : {})
				>
			>
		: never

/** Full `ADD COLUMN` (PGT-19, fact `addColumn`): it takes the full column definition and may be followed by `, <action>`. */
export type FullAddColumn<C extends ColumnCtx> = DialectFact<C["db"], "addColumn"> extends "full" ? true : never

/** SQLite: the definition ends the statement (SQLT-21); PostgreSQL goes on with the next action. */
type AlterColumnFinish<Tokens extends ParserMonad, C extends ColumnCtx, Db extends JsqlDatabaseShape> =
	DialectFact<C["db"], "addColumn"> extends "restricted"
		? FinishAlterStatement<Tokens, Db>
		: ParseAlterActions<Tokens, Db, C["schema"], C["table"]>
