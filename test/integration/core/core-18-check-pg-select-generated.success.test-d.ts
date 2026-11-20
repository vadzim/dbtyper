// Integration Test: CORE-18 Check: select g from a stored generated column
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table t (id integer not null, a integer not null, g integer not null generated always as (a + 1) stored)`,
	)
	.database()

// ✅ SUCCESS: CORE-18
const _result = await _db.query(`select g from t`)

expectType<typeof _result>(toBe<{ g: number }[]>())
