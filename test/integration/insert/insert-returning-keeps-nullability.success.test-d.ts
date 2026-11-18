// Integration Test: DML-13: RETURNING keeps the columns nullability
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text not null, name text not null, email text, active boolean not null);`)
	.database()

// ✅ SUCCESS: DML-13: RETURNING keeps the columns nullability

const _result = await _db.query(`insert into users (id, name, active) values ('1', 'A', true) returning id, email;`)

expectType<typeof _result>(toBe<{ id: string; email: string | null }[]>())
