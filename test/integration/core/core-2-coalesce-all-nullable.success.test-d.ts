// Integration Test: CORE-2: COALESCE of only nullable arguments is nullable
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null, email text);`)
	.database()

// ✅ SUCCESS: CORE-2: COALESCE of only nullable arguments is nullable
const _result = await _db.query(`select coalesce(email, null) as f from users;`)

expectType<typeof _result>(toBe<{ f: string | null }[]>())
