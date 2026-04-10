import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlReadStatement } from "../parser/sql-read-statement.js"
import type { SqlDatabaseLike } from "./sql-database.js"
import type { SqlApplyStatement, SqlStatementLike } from "./sql-apply-statement.js"

export type SqlApply<Db extends SqlDatabaseLike | SqlParseError<string>, Sql extends string> =
	SqlReadStatement<Sql> extends [infer ReadResult, infer Rest extends string]
		? ReadResult extends SqlParseError<string>
			? [ReadResult, Rest]
			: ReadResult extends SqlStatementLike
				? [SqlApplyStatement<Db, ReadResult>, Rest]
				: [SqlParseError<"Unsupported SqlApply statement">, Rest]
		: [SqlParseError<"Unknown sql statement">, ""]
