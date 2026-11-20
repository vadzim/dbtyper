// Integration Test: CORE-19 Check: drop view if exists on a missing view applies
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null, email text);`)
	.apply(`drop view if exists v;`)
	.database()

// ✅ SUCCESS: CORE-19
const _result = await _db.query(`select id from users`)

expectType<typeof _result>(toBe<{ id: number }[]>())
