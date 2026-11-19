// Integration Test: SEL-3 star from a table
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

// ✅ SUCCESS: SEL-3 star from a table
const _result = await _db.query(`select * from users;`)

expectType<typeof _result>(toBe<{ id: number; name: string }[]>())
