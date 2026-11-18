// Integration Test: DML-13: RETURNING takes expressions with aliases
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null, email text);`)
	.database()

// ✅ SUCCESS: DML-13: RETURNING takes expressions with aliases
const _result = await _db.query(`insert into users (id, name) values (1, 'A') returning id, email, upper(name) as n;`)

expectType<typeof _result>(toBe<{ id: number; email: string | null; n: string }[]>())
