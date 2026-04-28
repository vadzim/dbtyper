import { describe, it } from "node:test"
import type { JsqlUpdateStatementResult } from "../core/jsql-shapes.ts"
import type { ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import type { Expect, Extends, Tuple3At2 } from "./test-utils/type-test-utils.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

type DbUsers = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				users: {
					kind: "table"
					columns: { id: string; name: string }
					column_sql_types: { id: "uuid"; name: "text" }
				}
			}
		}
	}
}

type UpOk = ParseSqlStatement<ParseSqlTokens<`update users set name = 'x' where users.id = 'u';`>, DbUsers>
type _upOk = Expect<Extends<Tuple3At2<UpOk>, JsqlUpdateStatementResult>>

type UpSetParam = ParseSqlStatement<
	ParseSqlTokens<`update users set name = :n where id = 'u';`>,
	DbUsers,
	{ n: { ts: string; sql: "text" } }
>
type _upSetParam = Expect<Extends<Tuple3At2<UpSetParam>, JsqlUpdateStatementResult>>

type UpBadSet = ParseSqlStatement<ParseSqlTokens<`update users set name = 1 where id = 'u';`>, DbUsers>
type _upBadSet = Expect<Extends<Tuple3At2<UpBadSet>, SqlParserError<"Incompatible value type for column">>>

type UpBadWhere = ParseSqlStatement<ParseSqlTokens<`update users set name = 'x' where id = 1;`>, DbUsers>
type _upBadWhere = Expect<Extends<Tuple3At2<UpBadWhere>, SqlParserError<"Incompatible types in comparison">>>

describe("parse-update (type tests)", () => {
	it("compile-time assertions above", () => {})
})
