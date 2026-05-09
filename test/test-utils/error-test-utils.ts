import type { ParseSqlTokens } from "../../src/lexer/sql-tokens.ts"
import type { ParseSqlStatement } from "../../src/parser/parse-sql-statement.ts"
import type { DbtyperError } from "../../src/sql-parser-error.ts"
import type { DbPublicUsers } from "./test-databases.ts"
import type { Matches } from "./type-test-utils.ts"
import type { JsqlDatabaseShape } from "../../src/core/jsql-shapes.ts"

export type ParseErrorneousText<S extends string> = ParseSqlStatement<ParseSqlTokens<`${S}; ${Rest}`>, DbPublicUsers>

type Rest = "select 42;"
type TokensRest = ParseSqlTokens<Rest>

export type CheckErrorneousResult<Result, S extends string> = Matches<
	Result,
	[TokensRest, DbPublicUsers, DbtyperError<-1, S>]
>

export type CheckErrorneousResultWithCode<
	Result,
	Code extends -1 | keyof typeof import("../../src/sql-parser-error.ts").errors,
	Message extends string,
> = Matches<Result, [TokensRest, DbPublicUsers, DbtyperError<Code, Message>]>

// Helper to extract error from ParseSqlStatement result
export type ExtractQueryError<DbShape extends JsqlDatabaseShape, Query extends string> = ParseSqlStatement<
	ParseSqlTokens<Query>,
	DbShape
>[2]
