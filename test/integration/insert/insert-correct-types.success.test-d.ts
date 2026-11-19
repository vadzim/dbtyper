// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id text, age integer, active boolean);`)
	.database()
// ✅ SUCCESS: correct types

const _result = await _db.query(`insert into users (id, age, active) values ('1', 25, true) returning *;`)

expectType<typeof _result>(
	toBe<
		Array<{
			id: string | null
			age: number | null
			active: boolean | null
		}>
	>(),
)
