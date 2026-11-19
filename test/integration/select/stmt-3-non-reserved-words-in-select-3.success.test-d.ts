// Integration Test: SELECT - STMT-3 operand and unary minus positions
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table t1 (type text not null, key integer not null, first integer not null);`)
	.database()

// ✅ SUCCESS: STMT-3 non-reserved operands
const _result = await _db.query(`select -key as k, first * key as p from t1;`)

expectType<typeof _result>(toBe<{ k: number; p: number }[]>())
