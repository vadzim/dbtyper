// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id text, name text, email text);`)
	.database()

// ✅ SUCCESS: RETURNING specific columns

const _result = await _db.query(
	`insert into users (id, name, email) values ('1', 'Alice', 'alice@example.com') returning id, name;`,
)

expectType<typeof _result>(
	toBe<
		Array<{
			id: string | null
			name: string | null
		}>
	>(),
)
