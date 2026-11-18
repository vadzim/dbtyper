// Integration Test: SELECT - STMT-3 qualified names and alias after AS
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table t1 (type text not null, key integer not null, first integer not null);`)
	.database()

// ✅ SUCCESS: STMT-3 non-reserved aliases
const _result = await _db.query(`select t1.type as index, t1.key + first as next from t1;`)

expectType<typeof _result>(toBe<{ index: string; next: number }[]>())
