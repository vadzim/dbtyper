// Integration Test: SEL-3 star from a derived table
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

// ✅ SUCCESS: SEL-3 star from a derived table
const _result = await _db.query(`select * from (select id, name from users) d;`)

expectType<typeof _result>(toBe<{ id: number; name: string }[]>())
