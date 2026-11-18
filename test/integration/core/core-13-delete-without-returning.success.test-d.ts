// Integration Test: CORE-13: DELETE without RETURNING resolves to an empty row list
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null, email text);`)
	.database()

// ✅ SUCCESS: CORE-13: DELETE without RETURNING resolves to an empty row list
const _result = await _db.query(`delete from users where id = 1;`)

expectType<typeof _result>(toBe<[]>())
