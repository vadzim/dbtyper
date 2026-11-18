// Integration Test: SELECT - EXPR-5 / EXPR-6 / EXPR-2 a column as right operand and unary minus operand
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table t (a integer not null, b integer not null);`)
	.database()

// ✅ SUCCESS: EXPR-5 column as right operand
const _add = await _db.query(`select a + b as s from t;`)
expectType<typeof _add>(toBe<{ s: number }[]>())

const _mul = await _db.query(`select a * a as s from t;`)
expectType<typeof _mul>(toBe<{ s: number }[]>())

const _qual = await _db.query(`select t.a - t.b as s from t where a + b > 1;`)
expectType<typeof _qual>(toBe<{ s: number }[]>())

// ✅ SUCCESS: EXPR-6 unary minus on a column
const _neg = await _db.query(`select -a as x from t where -a < 0;`)
expectType<typeof _neg>(toBe<{ x: number }[]>())

const _negParen = await _db.query(`select (-a) as x from t;`)
expectType<typeof _negParen>(toBe<{ x: number }[]>())

// ✅ SUCCESS: EXPR-5 mixed precedence with columns
const _mix = await _db.query(`select a / b + a % b - a ^ 2 as s from t;`)
expectType<typeof _mix>(toBe<{ s: number }[]>())
