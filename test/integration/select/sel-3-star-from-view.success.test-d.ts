// Integration Test: SEL-3 star from a view
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null);`)
	.apply(`create view v as select id, name from users;`)
	.database()

// ✅ SUCCESS: SEL-3 star from a view
const _result = await _db.query(`select * from v;`)

expectType<typeof _result>(toBe<{ id: number; name: string }[]>())
