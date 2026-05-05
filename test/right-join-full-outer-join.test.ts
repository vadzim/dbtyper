import { describe, it } from "node:test"
import type { JsqlDatabaseShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { Expect, Extends, Tuple3At2 } from "./test-utils/type-test-utils.ts"

type DbJoins = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				users: {
					kind: "table"
					columns: { id: "integer"; name: "text" }
				}
				orders: {
					kind: "table"
					columns: { id: "integer"; user_id: "integer"; total: "integer" }
				}
			}
		}
	}
	scalarTypes: Record<string, unknown>
} & JsqlDatabaseShape

// Test RIGHT JOIN parses successfully
type TRightJoin = ParseSqlStatement<
	ParseSqlTokens<`select * from users right join orders on users.id = orders.user_id;`>,
	DbJoins
>
type _tRightJoin = Expect<Extends<Tuple3At2<TRightJoin>, { kind: "select" }>>

// Test RIGHT OUTER JOIN parses successfully
type TRightOuterJoin = ParseSqlStatement<
	ParseSqlTokens<`select * from users right outer join orders on users.id = orders.user_id;`>,
	DbJoins
>
type _tRightOuterJoin = Expect<Extends<Tuple3At2<TRightOuterJoin>, { kind: "select" }>>

// Test FULL OUTER JOIN parses successfully
type TFullOuterJoin = ParseSqlStatement<
	ParseSqlTokens<`select * from users full outer join orders on users.id = orders.user_id;`>,
	DbJoins
>
type _tFullOuterJoin = Expect<Extends<Tuple3At2<TFullOuterJoin>, { kind: "select" }>>

// Test FULL JOIN (without OUTER) parses successfully
type TFullJoin = ParseSqlStatement<
	ParseSqlTokens<`select * from users full join orders on users.id = orders.user_id;`>,
	DbJoins
>
type _tFullJoin = Expect<Extends<Tuple3At2<TFullJoin>, { kind: "select" }>>

describe("right-join-full-outer-join (type tests)", () => {
	it("compile-time assertions above", () => {})
})
