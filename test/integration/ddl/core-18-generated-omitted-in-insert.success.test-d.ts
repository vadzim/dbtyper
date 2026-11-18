// Integration Test: DML-4 a generated NOT NULL column may be omitted from the INSERT column list (CORE-18)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table t (id integer not null, a integer not null, g integer not null generated always as (a + 1) stored);`,
	)
	.database()

// ✅ SUCCESS: DML-4 only the other NOT NULL columns are required
const _result = await _db.query(`insert into t (id, a) values (1, 2);`)

expectType<typeof _result>(toBe<[]>())
