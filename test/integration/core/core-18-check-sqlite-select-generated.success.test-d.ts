// Integration Test: CORE-18 Check: SQLite generated column is nullable
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { sqliteDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table t (a integer not null, b integer as (a * 2) stored)`)
	.database()

// ✅ SUCCESS: CORE-18
const _result = await _db.query(`select b from t`)

expectType<typeof _result>(toBe<{ b: number | null }[]>())
