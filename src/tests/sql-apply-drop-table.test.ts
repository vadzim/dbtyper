import { describe, it } from "node:test"
import type { SqlDropTable } from "../parser/sql-drop-table.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlApplyDropTable } from "../engine/sql-apply-drop-table.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type Db0 = {
	readonly kind: "database"
	readonly defaultSchema: "test"
	readonly schemas: {
		test: {
			users: { id: number }
			posts: { id: number; user_id: number }
		}
		auth: {
			sessions: { id: string }
		}
	}
}

type DropExistingNoIfExists = SqlApplyDropTable<Db0, SqlDropTable<`drop table test.users`>>
type _DropExistingNoIfExists = Expect<
	Matches<
		DropExistingNoIfExists,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					posts: { id: number; user_id: number }
				}
				auth: {
					sessions: { id: string }
				}
			}
		}
	>
>

type DropExistingIfExists = SqlApplyDropTable<Db0, SqlDropTable<`drop table if exists test.users`>>
type _DropExistingIfExists = Expect<
	Matches<
		DropExistingIfExists,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					posts: { id: number; user_id: number }
				}
				auth: {
					sessions: { id: string }
				}
			}
		}
	>
>

type DropMissingNoIfExists = SqlApplyDropTable<Db0, SqlDropTable<`drop table test.missing`>>
type _DropMissingNoIfExists = Expect<
	Matches<DropMissingNoIfExists, SqlParseError<`Unknown dropped table "test.missing" in database`>>
>

type DropMissingIfExists = SqlApplyDropTable<Db0, SqlDropTable<`drop table if exists test.missing`>>
type _DropMissingIfExists = Expect<Matches<DropMissingIfExists, Db0>>

type DropDefaultSchemaUnqualified = SqlApplyDropTable<Db0, SqlDropTable<`drop table users`>>
type _DropDefaultSchemaUnqualified = Expect<
	Matches<
		DropDefaultSchemaUnqualified,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					posts: { id: number; user_id: number }
				}
				auth: {
					sessions: { id: string }
				}
			}
		}
	>
>

type DropExplicitSchemaQualified = SqlApplyDropTable<Db0, SqlDropTable<`drop table auth.sessions`>>
type _DropExplicitSchemaQualified = Expect<
	Matches<
		DropExplicitSchemaQualified,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					users: { id: number }
					posts: { id: number; user_id: number }
				}
				auth: {}
			}
		}
	>
>

describe("sql apply drop table", () => {
	it("should run", () => {})
})
