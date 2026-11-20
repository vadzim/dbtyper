// Integration Test: CORE-4 Check: EXISTS is number, non-null (SQLite, SQLT-9)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { sqliteDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table users (id integer not null, name text not null, email text);`)
	.database()

// ✅ SUCCESS: CORE-4
const _result = await _db.query(`select exists (select 1 from users) as x from users`)

expectType<typeof _result>(toBe<{ x: number }[]>())
