// Integration Test: CORE-2: CASE is nullable when a branch is
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null, email text);`)
	.database()

// ✅ SUCCESS: CORE-2: CASE is nullable when a branch is
const _result = await _db.query(`select case when id = 1 then email else 'x' end as c from users;`)

expectType<typeof _result>(toBe<{ c: string | null }[]>())
