import type { SqlAlterTable } from "./sql-alter-table.js"
import type { SqlCreateSchema } from "./sql-create-schema.js"
import type { SqlCreateTable } from "./sql-create-table.js"
import type { SqlDropSchema } from "./sql-drop-schema.js"
import type { SqlDropTable } from "./sql-drop-table.js"
import type { InitBuffer, SqlParseError } from "./sql-tokens.js"

export type SqlStatement<Sql extends string> =
	| SqlAlterTable<InitBuffer<Sql>>[0]
	| SqlCreateSchema<InitBuffer<Sql>>[0]
	| SqlCreateTable<InitBuffer<Sql>>[0]
	| SqlDropSchema<InitBuffer<Sql>>[0]
	| SqlDropTable<InitBuffer<Sql>>[0] extends infer Result
	? [Result] extends [never]
		? SqlParseError<"Unknown sql statement">
		: Result
	: SqlParseError<"Unknown sql statement">
