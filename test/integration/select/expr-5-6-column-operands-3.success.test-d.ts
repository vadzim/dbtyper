// Integration Test: SELECT - EXPR-5 qualified operands in select and where
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table t (a integer not null, b integer not null);`)
	.database()

// ✅ SUCCESS: EXPR-5 qualified columns
const _result = await _db.query(`select t.a - t.b as s from t where a + b > 1;`)

expectType<typeof _result>(toBe<{ s: number }[]>())
