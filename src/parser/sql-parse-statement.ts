import type { SqlAlterTable } from "./sql-alter-table.js"
import type { SqlCreateSchema } from "./sql-create-schema.js"
import type { SqlCreateTable } from "./sql-create-table.js"
import type { SqlDropSchema } from "./sql-drop-schema.js"
import type { SqlDropTable } from "./sql-drop-table.js"
import type { BufferLike, InitBuffer, SqlParseError } from "./sql-tokens.js"

export type SqlStatementLoose<Sql extends string> = SqlStatement<InitBuffer<Sql>>[0]

export type SqlStatement<Buffer extends BufferLike> =
	| SqlAlterTable<Buffer>
	| SqlCreateSchema<Buffer>
	| SqlCreateTable<Buffer>
	| SqlDropSchema<Buffer>
	| SqlDropTable<Buffer> extends infer Result
	? [Result] extends [never]
		? [SqlParseError<"Unknown sql statement">, Buffer]
		: Result extends [infer Result, infer Rest extends BufferLike]
			? [Result, Rest]
			: [SqlParseError<"Unknown sql statement">, Buffer]
	: [SqlParseError<"Unknown sql statement">, Buffer]
