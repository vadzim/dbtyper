// Integration Test: db․query() accepts non-RETURNING statements
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()

// ✅ UPDATE without RETURNING should be accepted by query()

const result = await db.query(`update users set name = 'Bob' where id = '1';`)

// Result type should be unknown

type _check = Expect<Matches<typeof result, unknown>>
