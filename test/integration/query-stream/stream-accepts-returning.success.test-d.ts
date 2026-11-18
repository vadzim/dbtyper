// Integration Test: _db․stream() rejects non-RETURNING statements
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()

// ✅ DELETE with RETURNING should be accepted by stream()

const _result = await Array.fromAsync(await _db.stream(`delete from users where id = '1' returning id, name;`))

expectType<typeof _result>(
	toBe<
		Array<{
			id: string | null
			name: string | null
		}>
	>(),
)
