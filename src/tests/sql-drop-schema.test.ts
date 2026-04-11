import type { SqlStatements } from "../parser/sql-parse-statement.js"
import type { InitBuffer } from "../parser/sql-tokens.js"
import { describe, it } from "node:test"
import type { Expect, ExpectFalse, Matches } from "../test-utils/type-test-utils.js"

type DropAuth = SqlStatements<InitBuffer<`drop schema if exists auth;`>>[0][0]
type _DropAuth = Expect<
	Matches<
		DropAuth,
		{
			readonly kind: "drop_schema"
			readonly name: "auth"
			readonly ifExists: true
		}
	>
>

type DropBilling = SqlStatements<InitBuffer<`drop schema billing`>>[0][0]
type _DropBilling = Expect<
	Matches<
		DropBilling,
		{
			readonly kind: "drop_schema"
			readonly name: "billing"
			readonly ifExists: false
		}
	>
>

type BadDrop = SqlStatements<InitBuffer<`drop table auth`>>[0]
type _BadDrop = ExpectFalse<Matches<BadDrop, { readonly kind: "drop_schema" }>>

describe("sql drop schema", () => {
	it("should run", () => {})
})
