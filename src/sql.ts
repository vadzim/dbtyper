// Public API.
// Do not expose internal types here.
// Do not import this file in internal modules or tests.

export type { SqlParserError } from "./parser/sql-tokens.js"
export type {
	ParseSqlStatement as SqlStatement,
	ParseSqlStatements as SqlStatements,
	ParseSqlStatementsRecovering as SqlStatementsRecovering,
} from "./parser/sql-parse-statement.js"
export type { SqlDatabaseLike } from "./engine/sql-database.js"

export { sqlDatabase, sqlStatement, migration } from "./engine/sql-statement.js"
