import type { SqlAlterTable } from "./sql-alter-table.js"
import type { SqlCreateSchema } from "./sql-create-schema.js"
import type { SqlCreateTable } from "./sql-create-table.js"
import type { SqlDropSchema } from "./sql-drop-schema.js"
import type { SqlDropTable } from "./sql-drop-table.js"
import type { SqlParseError } from "./sql-parse-error.js"

export type SqlStatement<Sql extends string> =
	| SqlAlterTable<Sql>
	| SqlCreateSchema<Sql>
	| SqlCreateTable<Sql>
	| SqlDropSchema<Sql>
	| SqlDropTable<Sql> extends infer Result
	? [Result] extends [never]
		? SqlParseError<"Unknown sql statement">
		: Result
	: SqlParseError<"Unknown sql statement">
