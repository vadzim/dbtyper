// Integration Test: SELECT || concatenation success
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id uuid, name text, age integer, score numeric, active boolean);`)
	.database()

// ✅ text || boolean → text
const _result = await _db.query(`select 'Active: ' || active as message from users;`)

expectType<typeof _result>(toBe<Array<{ message: string | null }>>())
