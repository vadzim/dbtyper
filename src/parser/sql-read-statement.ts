import type { SqlParseError } from "./sql-parse-error.js"
import type { SqlStatement } from "./sql-parse-statement.js"
import type { Trim } from "./sql-parse-primitives.js"

export type SplitFirstSqlStatement<S extends string> = S extends `${infer Head};${infer Tail}`
	? [statement: Trim<Head>, rest: Trim<Tail>]
	: [statement: Trim<S>, rest: ""]

export type SqlReadStatement<S extends string> =
	SplitFirstSqlStatement<S> extends [infer StatementSql extends string, infer Rest extends string]
		? [SqlStatement<StatementSql>] extends [infer Parsed]
			? Parsed extends SqlParseError<string>
				? [Parsed, Rest]
				: [Parsed, Rest]
			: [SqlParseError<"Unknown sql statement">, Rest]
		: [SqlParseError<"Unknown sql statement">, ""]
