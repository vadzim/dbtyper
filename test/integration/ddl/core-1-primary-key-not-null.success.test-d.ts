// Integration Test: CORE-1 a PRIMARY KEY column is NOT NULL
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table k (code text primary key);`)
	.database()

// ✅ SUCCESS: CORE-1 inline PRIMARY KEY
const _result = await _db.query(`select code from k;`)

expectType<typeof _result>(toBe<{ code: string }[]>())
