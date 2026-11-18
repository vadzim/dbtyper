// Integration Test: PARAM-10 - a bigint parameter is typed bigint and compares with a bigint column
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table t (n bigint not null);`)
	.database()

// ✅ SUCCESS: PARAM-10 bigint parameter against bigint column
const _result = await _db.query(`select * from t where n = :x;`, { x: 1n })

expectType<typeof _result>(toBe<Array<{ n: bigint }>>())
