// Integration Test: CORE-4: EXISTS is non-null
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null, email text);`)
	.database()

// ✅ SUCCESS: CORE-4: EXISTS is non-null
const _result = await _db.query(`select exists (select 1 from users) as x from users;`)

expectType<typeof _result>(toBe<{ x: boolean }[]>())
