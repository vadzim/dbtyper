// Integration Test: CORE-1 a named inline PRIMARY KEY makes its column NOT NULL, other columns stay nullable
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table n (id integer constraint n_pk primary key, v text);`)
	.database()

// ✅ SUCCESS: CORE-1 named inline PRIMARY KEY
const _result = await _db.query(`select id, v from n;`)

expectType<typeof _result>(toBe<{ id: number; v: string | null }[]>())
