// Integration Test: SELECT - EXPR-6 parenthesised unary minus
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table t (a integer not null, b integer not null);`)
	.database()

// ✅ SUCCESS: EXPR-6 (-a)
const _result = await _db.query(`select (-a) as x from t;`)

expectType<typeof _result>(toBe<{ x: number }[]>())
