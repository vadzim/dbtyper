import type { SqlAlterTable } from "./sql-alter-table.js"
import type { SqlCreateTable } from "./sql-create-table.js"
import type { SqlDropTable } from "./sql-drop-table.js"
import type { SqlParseError } from "./sql-parse-error.js"

export type SqlParseMigration<Sql extends string> =
	| SqlAlterTable<Sql>
	| SqlCreateTable<Sql>
	| SqlDropTable<Sql> extends infer Result
	? [Result] extends [never]
		? SqlParseError<"Unknown sql statement">
		: Result
	: SqlParseError<"Unknown sql statement">
