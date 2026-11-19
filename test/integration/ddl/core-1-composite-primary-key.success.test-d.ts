// Integration Test: CORE-1 a composite table-level PRIMARY KEY makes every listed column NOT NULL
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table c (a integer, b integer, v text, constraint c_pk primary key (a, b));`)
	.database()

// ✅ SUCCESS: CORE-1 both key columns are non-null, the other column stays nullable
const _result = await _db.query(`select a, b, v from c;`)

expectType<typeof _result>(toBe<{ a: number; b: number; v: string | null }[]>())
