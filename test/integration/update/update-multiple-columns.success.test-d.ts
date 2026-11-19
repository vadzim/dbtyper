// Integration Test: UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id text, name text, email text);`)
	.database()
// ✅ SUCCESS: UPDATE multiple columns

const _result = await _db.query(
	`update users set name = 'Alice', email = 'alice@example.com' where id = '1' returning *;`,
)

expectType<typeof _result>(
	toBe<
		Array<{
			id: string | null
			name: string | null
			email: string | null
		}>
	>(),
)
