// Integration Test: TYPE-8: an expression made nullable by SEL/EXPR rules is T | null
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text not null, name text not null, email text, active boolean not null);`)
	.database()

// ✅ SUCCESS: TYPE-8: an expression made nullable by SEL/EXPR rules is T | null

const _result = await _db.query(`select case when active then name end as n from users;`)

expectType<typeof _result>(toBe<{ n: string | null }[]>())
