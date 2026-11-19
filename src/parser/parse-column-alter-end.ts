import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors } from "../dbtyper-error.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { JsqlDbReplaceColumn } from "../core/jsql-utils.ts"
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
	? [S["def"], PgAlter<C>] extends [false, never]
		? ColumnFail<
				Tokens,
				C,
				FormatError<Errors["SQLITE_ADD_COLUMN_RESTRICTED"], ["NOT NULL without a non-null DEFAULT"]>
			>
		: AlterColumnStore<Tokens, C, S>
	: AlterColumnStore<Tokens, C, S>

type AlterColumnStore<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	OneCol<ColumnEntry<C, S>> extends { cols: infer Cols; facts: infer Facts }
		? AlterColumnFinish<
				Tokens,
				C,
				JsqlDbReplaceColumn<
					C["db"],
					C["schema"],
					C["table"],
					C["name"],
					{
						type: C["name"] extends keyof Cols ? Cols[C["name"]] & SqlTypeShape : SqlTypeShape
					} & (C["name"] extends keyof Facts ? Facts[C["name"]] : {})
				>
			>
		: never

/** PostgreSQL (PGT-19): `ADD COLUMN` takes the full column definition and may be followed by `, <action>`. */
export type PgAlter<C extends ColumnCtx> = DialectFact<C["db"], "ddl"> extends true ? never : true

/** SQLite: the definition ends the statement (SQLT-21); PostgreSQL goes on with the next action. */
type AlterColumnFinish<Tokens extends ParserMonad, C extends ColumnCtx, Db extends JsqlDatabaseShape> =
	DialectFact<C["db"], "ddl"> extends true
		? FinishAlterStatement<Tokens, Db>
		: ParseAlterActions<Tokens, Db, C["schema"], C["table"]>
