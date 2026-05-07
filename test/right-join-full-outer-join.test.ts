import { describe, it } from "node:test"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type {
	Expect,
	Extends,
} from "./test-utils/type-test-utils.ts"
import type {
	TText,
	TInteger,
} from "./test-utils/sql-type-helpers.ts"

type DbJoins = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				users: {
					kind: "table"
					columns: { id: TInteger; name: TText }
				}
				orders: {
					kind: "table"
					columns: { id: TInteger; user_id: TInteger; total: TInteger }
				}
			}
		}
	}
}

// Test RIGHT JOIN parses successfully
type TRightJoin = ParseSqlStatement<
	ParseSqlTokens<`select * from users right join orders on users.id = orders.user_id;`>,
	DbJoins
>
type _tRightJoin = Expect<Extends<TRightJoin[2], { kind: "select" }>>

// Test RIGHT OUTER JOIN parses successfully
type TRightOuterJoin = ParseSqlStatement<
	ParseSqlTokens<`select * from users right outer join orders on users.id = orders.user_id;`>,
	DbJoins
>
type _tRightOuterJoin = Expect<Extends<TRightOuterJoin[2], { kind: "select" }>>

// Test FULL OUTER JOIN parses successfully
type TFullOuterJoin = ParseSqlStatement<
	ParseSqlTokens<`select * from users full outer join orders on users.id = orders.user_id;`>,
	DbJoins
>
type _tFullOuterJoin = Expect<Extends<TFullOuterJoin[2], { kind: "select" }>>

// Test FULL JOIN (without OUTER) parses successfully
type TFullJoin = ParseSqlStatement<
	ParseSqlTokens<`select * from users full join orders on users.id = orders.user_id;`>,
	DbJoins
>
type _tFullJoin = Expect<Extends<TFullJoin[2], { kind: "select" }>>

describe("right-join-full-outer-join (type tests)", () => {
	it("compile-time assertions above", () => {})
})
