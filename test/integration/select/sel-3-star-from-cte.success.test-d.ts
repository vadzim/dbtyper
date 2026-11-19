// Integration Test: SEL-3 star from a CTE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

// ✅ SUCCESS: SEL-3 star from a CTE
const _result = await _db.query(`with c as (select id, name from users) select * from c;`)

expectType<typeof _result>(toBe<{ id: number; name: string }[]>())
