import type { SqlAlterTable } from "./sql-alter-table.js"
import type { SqlCreateSchema } from "./sql-create-schema.js"
import type { SqlCreateTable } from "./sql-create-table.js"
import type { SqlDropSchema } from "./sql-drop-schema.js"
import type { SqlDropTable } from "./sql-drop-table.js"
import type { Buffer, InitBuffer, SqlParseError } from "./sql-tokens.js"

type ParseTupleResult<T> = T extends readonly [infer R, infer _ extends Buffer] ? R : never

export type SqlStatement<Sql extends string> =
	| ParseTupleResult<SqlAlterTable<InitBuffer<Sql>>>
	| ParseTupleResult<SqlCreateSchema<InitBuffer<Sql>>>
	| ParseTupleResult<SqlCreateTable<InitBuffer<Sql>>>
	| ParseTupleResult<SqlDropSchema<InitBuffer<Sql>>>
	| ParseTupleResult<SqlDropTable<InitBuffer<Sql>>> extends infer Result
	? [Result] extends [never]
		? SqlParseError<"Unknown sql statement">
		: Result
	: SqlParseError<"Unknown sql statement">
