// Integration Test: CORE-5: the literal NULL alone is typed null
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null, email text);`)
	.database()

// ✅ SUCCESS: CORE-5: the literal NULL alone is typed null
const _result = await _db.query(`select null as z from users;`)

expectType<typeof _result>(toBe<{ z: null }[]>())
