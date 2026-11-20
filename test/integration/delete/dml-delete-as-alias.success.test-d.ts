// Integration Test: DELETE FROM t AS alias (#165)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

// ✅ SUCCESS
const _result = await db.query(`delete from users as u where u.id = 1 returning u.id;`)

expectType<typeof _result>(toBe<Array<{ id: number }>>())
