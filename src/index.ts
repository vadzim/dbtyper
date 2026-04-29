// typesql — package entry (published build). Internal modules import each other, not this file.

export type {
	InferScalarTypesFromDriver,
	MergeDbPreserveScalars,
	ScalarTypesOf,
	SqlDatabaseConfig,
} from "./engine/sql-database.ts"
export type * from "../core/sql.ts"
export {
	sqlDatabase,
	migration,
	CompiledDataBase,
	ConnectedDataBase,
	type ApplyMigrationOptions,
	type MigrationExport,
	type ParamRuntimeValues,
	type SqlDatabase,
	type SqlDriver,
	type SqlDriverParams,
} from "./engine/sql-database.ts"
export type { SqlSelectRow } from "./engine/sql-query.ts"
export type { ApplyParsedStatements, ApplyStatements, ParseSqlStatement } from "./parser/parse-sql-statement.ts"
export type { EmptyExpressionParams, ExpressionParamsShape } from "./parser/parse-expression.ts"
