import type { JsqlDatabaseShape } from "../../src/core/jsql-shapes.ts"
import type { SqlParserError } from "../../src/sql-parser-error.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "../../src/parser/parse-expression.ts"
import type { SqlSelectRowSqlTypes } from "../../src/core/sql-query.ts"
import type { ApplySqlToTsConversion } from "../../src/core/sql-to-ts-conversion.ts"
import type { PostgresTypeMap } from "../../src/postgres/postgres-type-map.ts"

/**
 * Infers the **row object** type for a single `SELECT` / `WITH … SELECT` string against `Db`.
 * Non-select statements resolve to {@link SqlParserError} so invalid uses become type errors.
 *
 * This applies SQL-to-TypeScript conversion using the database's scalarTypes map.
 */
export type SqlSelectRow<
	Db extends JsqlDatabaseShape | SqlParserError<string>,
	Text extends string,
	ScalarTypes extends Record<string, unknown> = PostgresTypeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Db extends JsqlDatabaseShape ? ApplySqlToTsConversion<SqlSelectRowSqlTypes<Db, Text, Params>, ScalarTypes> : Db

/** `SqlParserError<…>` when `Stmt` is not a typed `SELECT`; `null` when row inference succeeds (tooling hook). */
export type InferSqlErrors<
	Db extends JsqlDatabaseShape | SqlParserError<string>,
	Stmt extends string,
	ScalarTypes extends Record<string, unknown> = PostgresTypeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = [SqlSelectRow<Db, Stmt, ScalarTypes, Params>] extends [SqlParserError<infer M>] ? SqlParserError<M> : null
