// Integration Test: SELECT - STMT-3 select list, where, order by
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table t1 (type text not null, key integer not null, first integer not null);`)
	.database()

// ✅ SUCCESS: STMT-3 non-reserved words as names
const _result = await _db.query(`select type, key from t1 where key > 1 order by first;`)

expectType<typeof _result>(toBe<{ type: string; key: number }[]>())
