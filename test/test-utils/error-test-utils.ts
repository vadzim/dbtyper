import type { ParseSqlTokens } from "../../src/lexer/sql-tokens.ts"
import type { ParseSqlStatement } from "../../src/parser/parse-sql-statement.ts"
import type { SqlParserError } from "../../src/sql-parser-error.ts"
import type { DbPublicUsers } from "./test-databases.ts"
import type { Matches } from "./type-test-utils.ts"

export type ParseErrorneousText<S extends string> = ParseSqlStatement<ParseSqlTokens<`${S}; ${Rest}`>, DbPublicUsers>

type Rest = "select 42;"
type TokensRest = ParseSqlTokens<Rest>

export type CheckErrorneousResult<Result, S extends string> = Matches<
	Result,
	[TokensRest, DbPublicUsers, SqlParserError<S>]
>
