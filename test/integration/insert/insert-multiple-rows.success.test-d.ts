// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver }).apply(`create table users (id text, name text);`).database()
// ✅ SUCCESS: INSERT multiple rows

const _result = await _db.query(
	`insert into users (id, name) values ('1', 'Alice'), ('2', 'Bob'), ('3', 'Charlie') returning *;`,
)

expectType<typeof _result>(
	toBe<
		Array<{
			id: string | null
			name: string | null
		}>
	>(),
)
