// typesql — public API.
// Do not expose internal types here.
// Do not import this file in internal modules or tests.

export type { ParseSqlTokens, SqlParserError } from "./sql-tokens.ts"

// export type {
// 	ParseSqlStatement,
// 	ParseSqlStatements,
// 	ParseSqlStatementsRecovering,
// } from "../src/parser/parse-sql-statement.ts"

// export { sqlDatabase, sqlStatement, migration } from "../src/engine/sql-database.ts"

export type { JsqlDatabaseShape } from "./jsql-shapes.ts"
