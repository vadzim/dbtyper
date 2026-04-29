// typesql — package entry (published build). Internal modules import each other, not this file.

export type { MergeDbPreserveScalars, ScalarTypesOf, SqlScalarTypeMap } from "./engine/sql-database.ts"
export type * from "../core/sql.ts"
export { bindColonNamedParamsForPg } from "./postgres/bind-colon-named-params-for-pg.ts"
export {
	sqlDatabase,
	migration,
	patch,
	CompiledDataBase,
	ConnectedDataBase,
	type MigrationExport,
	type ParamRuntimeValues,
	type SqlDatabase,
	type SqlDriver,
} from "./engine/sql-database.ts"
export type { SqlSelectRow } from "./engine/sql-query.ts"
export type { ApplyParsedStatements, ApplyStatements, ParseSqlStatement } from "./parser/parse-sql-statement.ts"
export type { EmptyExpressionParams, ExpressionParamsShape } from "./parser/parse-expression.ts"
