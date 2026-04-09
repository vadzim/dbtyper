import type { SqlDropSchema } from "../parser/sql-drop-schema.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlApplyDropSchema } from "../engine/sql-apply-drop-schema.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type Db0 = {
	readonly kind: "database"
	readonly defaultSchema: "public"
	readonly schemas: {
		public: {
			users: { id: number }
		}
		auth: {
			sessions: { id: string }
		}
	}
}

type DropAuth = SqlApplyDropSchema<Db0, SqlDropSchema<`drop schema auth`>>
type _DropAuth = Expect<
	Matches<
		DropAuth,
		{
			readonly kind: "database"
			readonly defaultSchema: "public"
			readonly schemas: {
				readonly public: {
					readonly users: { id: number }
				}
			}
		}
	>
>

type DropMissingNoIf = SqlApplyDropSchema<Db0, SqlDropSchema<`drop schema missing`>>
type _DropMissingNoIf = Expect<Matches<DropMissingNoIf, SqlParseError<`Unknown dropped schema "missing" in database`>>>

type DropMissingIfExists = SqlApplyDropSchema<Db0, SqlDropSchema<`drop schema if exists missing`>>
type _DropMissingIfExists = Expect<Matches<DropMissingIfExists, Db0>>

describe("sql apply drop schema", () => {
	it("should run", () => {})
})
