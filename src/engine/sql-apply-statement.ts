import type { SqlDatabaseLike } from "./sql-database.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlCreateTableLike } from "../parser/sql-create-table.js"
import type { SqlDropTableLike } from "../parser/sql-drop-table.js"
import type { SqlAlterTableLike } from "../parser/sql-alter-table.js"
import type { SqlApplyAlterTable } from "./sql-apply-alter-table.js"
import type { SqlApplyCreateTable } from "./sql-apply-create-table.js"
import type { SqlApplyDropTable } from "./sql-apply-drop-table.js"

export type SqlApplyStatement<
	Db extends SqlDatabaseLike | SqlParseError<string>,
	Statement extends SqlAlterTableLike | SqlCreateTableLike | SqlDropTableLike | SqlParseError<string>,
> = Db extends SqlDatabaseLike
	? Statement extends SqlCreateTableLike
		? SqlApplyCreateTable<Db, Statement>
		: Statement extends SqlAlterTableLike
			? SqlApplyAlterTable<Db, Statement>
			: Statement extends SqlDropTableLike
				? SqlApplyDropTable<Db, Statement>
				: Statement extends SqlParseError<string>
					? Statement
					: SqlParseError<"Unsupported SqlApply statement">
	: Db
