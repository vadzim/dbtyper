import type { ParseSqlTokens } from "../../src/lexer/sql-tokens.ts"
import type { ParseSqlStatement } from "../../src/parser/parse-sql-statement.ts"
import type { DbtyperError, DbtyperErrorShape, ErrorCodes } from "../../src/dbtyper-error.ts"
import type { DbPublicUsers } from "./test-databases.ts"
import type { Matches } from "./type-test-utils.ts"
import type { JsqlDatabaseShape } from "../../src/core/jsql-shapes.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "../../src/parser/parse-expression.ts"
import type { DriverConfig } from "../../src/core/sql-database.ts"
import type { SqlSelectRowSqlTypes } from "../../src/core/sql-query.ts"
import type { ApplySqlToTsConversion } from "../../src/core/sql-to-ts-conversion.ts"
import type { PostgresDriverConfig } from "../../src/postgres/postgres-sql-driver.ts"

export type ParseErrorneousText<S extends string> = ParseSqlStatement<ParseSqlTokens<`${S}; ${Rest}`>, DbPublicUsers>

type Rest = "select 42;"
type TokensRest = ParseSqlTokens<Rest>

export type CheckErrorneousResult<Result, Code extends ErrorCodes, Message extends string> = Matches<
	Result,
	[TokensRest, DbPublicUsers, DbtyperError<Code, Message>]
>

// Helper to extract error from ParseSqlStatement result
export type ExtractQueryError<
	DbShape extends JsqlDatabaseShape,
	Query extends string,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = ParseSqlStatement<ParseSqlTokens<Query>, DbShape, Params>[2]

export type ExtractStreamError<
	Db extends JsqlDatabaseShape | DbtyperErrorShape,
	Query extends string,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	Config extends DriverConfig = PostgresDriverConfig,
> = Db extends JsqlDatabaseShape
	? ApplySqlToTsConversion<Config, SqlSelectRowSqlTypes<Config, Db, Query, Params>> extends infer Error extends
			DbtyperErrorShape
		? Error
		: null
	: Db
