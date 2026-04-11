import type { SqlStatementLoose } from "../parser/sql-parse-statement.js"
import { describe, it } from "node:test"
import type { Expect, ExpectFalse, Matches } from "../test-utils/type-test-utils.js"

type DropAuth = SqlStatementLoose<`drop schema if exists auth;`>
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

type DropBilling = SqlStatementLoose<`drop schema billing`>
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

type BadDrop = SqlStatementLoose<`drop table auth`>
type _BadDrop = ExpectFalse<Matches<BadDrop, { readonly kind: "drop_schema" }>>

describe("sql drop schema", () => {
	it("should run", () => {})
})
