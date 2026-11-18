// Integration Test: STMT-3 non-reserved words as unquoted names in select list, alias and expression positions
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table t1 (type text not null, key integer not null, first integer not null);`)
	.database()

// ✅ SUCCESS: STMT-3 select list, where, order by
const _list = await _db.query(`select type, key from t1 where key > 1 order by first;`)
expectType<typeof _list>(toBe<{ type: string; key: number }[]>())

// ✅ SUCCESS: STMT-3 qualified names and alias after AS
const _alias = await _db.query(`select t1.type as index, t1.key + first as next from t1;`)
expectType<typeof _alias>(toBe<{ index: string; next: number }[]>())

// ✅ SUCCESS: STMT-3 operand and unary minus positions
const _expr = await _db.query(`select -key as k, first * key as p from t1;`)
expectType<typeof _expr>(toBe<{ k: number; p: number }[]>())
