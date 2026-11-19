// Integration Test: CORE-5: NULL in COALESCE next to a non-null argument leaves it non-null
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null, email text);`)
	.database()

// ✅ SUCCESS: CORE-5: NULL in COALESCE next to a non-null argument leaves it non-null
const _result = await _db.query(`select coalesce(null, name) as c from users;`)

expectType<typeof _result>(toBe<{ c: string }[]>())
