// Integration Test: INSERT - CORE-20 ON CONFLICT (cols) DO NOTHING
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text);`)
	.database()

// ✅ SUCCESS: CORE-20
const _result = await _db.query(`insert into users (id, name) values (1, 'a') on conflict (id) do nothing;`)

expectType<typeof _result>(toBe<[]>())
