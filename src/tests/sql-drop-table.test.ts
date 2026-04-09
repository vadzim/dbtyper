import type { SqlDropTable } from "../parser/sql-drop-table.js"
import { describe, it } from "node:test"
import type { Expect, ExpectFalse, Matches } from "../test-utils/type-test-utils.js"

type DropUsers = SqlDropTable<`drop table if exists public.users;`>
type _DropUsers = Expect<
	Matches<
		DropUsers,
		{
			readonly kind: "drop_table"
			readonly target: readonly ["users", "public"]
			readonly ifExists: true
		}
	>
>

type BadDrop = SqlDropTable<`drop view public.users`>
type _BadDrop = ExpectFalse<Matches<BadDrop, { readonly kind: "drop_table" }>>

describe("sql drop table", () => {
	it("should run", () => {})
})
