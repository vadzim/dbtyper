// Public API.
// Do not expose internal types here.
// Do not import this file in internal modules or tests.

export type { ParseSqlTokens, SqlParserError } from "./parser/sql-tokens.js"
export type {
	ParseSqlStatement,
	ParseSqlStatements,
	ParseSqlStatementsRecovering,
} from "./parser/parse-sql-statement.js"
export type { SqlDatabaseLike } from "./engine/sql-database.js"

export { sqlDatabase, sqlStatement, migration } from "./engine/sql-statement.js"
