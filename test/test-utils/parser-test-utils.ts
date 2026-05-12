import type { JsqlDatabaseShape } from "../../src/core/jsql-shapes.ts"
import type { DbtyperError, DbtyperErrorShape } from "../../src/dbtyper-error.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "../../src/parser/parse-expression.ts"
import type { SqlSelectRowSqlTypes } from "../../src/core/sql-query.ts"
import type { ApplySqlToTsConversion } from "../../src/core/sql-to-ts-conversion.ts"
import type { PostgresDriverConfig } from "../../src/postgres/postgres-sql-driver.ts"
import type { DriverConfig } from "../../src/core/sql-database.ts"

/**
 * Infers the **row object** type for a single `SELECT` / `WITH … SELECT` string against `Db`.
 * Non-select statements resolve to error types so invalid uses become type errors.
 *
 * This applies SQL-to-TypeScript conversion using the database's scalarTypes map.
 */
export type SqlSelectRow<
	Db extends JsqlDatabaseShape | DbtyperErrorShape,
	Text extends string,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	Config extends DriverConfig = PostgresDriverConfig,
> = Db extends JsqlDatabaseShape ? ApplySqlToTsConversion<Config, SqlSelectRowSqlTypes<Config, Db, Text, Params>> : Db

/** `DbtyperError<…>` when `Stmt` is not a typed `SELECT`; `null` when row inference succeeds (tooling hook). */
export type InferSqlErrors<
	Db extends JsqlDatabaseShape | DbtyperErrorShape,
	Stmt extends string,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	Config extends DriverConfig = PostgresDriverConfig,
> = SqlSelectRow<Db, Stmt, Params, Config> extends DbtyperError<infer Code, infer M> ? DbtyperError<Code, M> : null
