// Integration Test: CORE-16 Check: text default 'x' applies
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null, email text);`)
	.apply(`create table t (n text default 'x')`)
	.database()

// ✅ SUCCESS: CORE-16
const _result = await _db.query(`select n from t`)

expectType<typeof _result>(toBe<{ n: string | null }[]>())
