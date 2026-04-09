import type { SqlDropSchema } from "../parser/sql-drop-schema.js"
import { describe, it } from "node:test"
import type { Expect, ExpectFalse, Matches } from "../test-utils/type-test-utils.js"

type DropAuth = SqlDropSchema<`drop schema if exists auth;`>
type _DropAuth = Expect<
	Matches<
		Omit<DropAuth, "source">,
		{
			readonly kind: "drop_schema"
			readonly name: "auth"
			readonly ifExists: true
		}
	>
>

type DropBilling = SqlDropSchema<`drop schema billing`>
type _DropBilling = Expect<
	Matches<
		Omit<DropBilling, "source">,
		{
			readonly kind: "drop_schema"
			readonly name: "billing"
			readonly ifExists: false
		}
	>
>

type BadDrop = SqlDropSchema<`drop table auth`>
type _BadDrop = ExpectFalse<Matches<BadDrop, { readonly kind: "drop_schema" }>>

describe("sql drop schema", () => {
	it("should run", () => {})
})
