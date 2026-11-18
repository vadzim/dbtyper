// Integration Test: CORE-2: arithmetic on a nullable column is nullable
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null, email text);`)
	.database()

// ✅ SUCCESS: CORE-2: arithmetic on a nullable column is nullable
const _result = await _db.query(`select id + 1 as a, id * (select max(id) from users) as b from users;`)

expectType<typeof _result>(toBe<{ a: number; b: number | null }[]>())
