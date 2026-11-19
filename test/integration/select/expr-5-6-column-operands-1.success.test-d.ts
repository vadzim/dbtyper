// Integration Test: SELECT - EXPR-5 column as right operand
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table t (a integer not null, b integer not null);`)
	.database()

// ✅ SUCCESS: EXPR-5 column as right operand
const _result = await _db.query(`select a + b as s from t;`)

expectType<typeof _result>(toBe<{ s: number }[]>())
