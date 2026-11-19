// Integration Test: ON CONFLICT DO UPDATE SET accepts a column named like a non-reserved keyword, as UPDATE SET does
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table t (id integer primary key, begin integer);`)
	.database()

// ✅ SUCCESS: `begin` is not reserved
const _result = await _db.query(`insert into t (id, begin) values (1, 2) on conflict (id) do update set begin = 3;`)

expectType<typeof _result>(toBe<[]>())
