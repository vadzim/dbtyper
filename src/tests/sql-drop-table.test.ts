import type { SqlDropTable } from "../sql.js"
import { describe, it } from "node:test"
import type { Equal, Expect, Matches } from "./type-test-utils.js"

type DropUsers = SqlDropTable<`drop table if exists public.users;`>
type _DropUsers = Expect<
	Matches<
		DropUsers,
		{
			readonly kind: "drop_table"
			readonly target: "public.users"
			readonly ifExists: true
			readonly source: string
		}
	>
>

type BadDrop = SqlDropTable<`drop view public.users`>
type _BadDrop = Expect<Equal<BadDrop, never>>

describe("sql drop table", () => {
	it("should run", () => {})
})
