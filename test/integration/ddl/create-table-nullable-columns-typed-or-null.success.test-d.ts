// Integration Test: TYPE-7: NOT NULL column is T, a column without NOT NULL is T | null (arrays too)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table u (id uuid not null, display_name text, tags text[]);`)
	.database()

// ✅ SUCCESS: TYPE-7: NOT NULL column is T, a column without NOT NULL is T | null (arrays too)

const _result = await _db.query(`select id, display_name, tags from u;`)

expectType<typeof _result>(toBe<{ id: string; display_name: string | null; tags: readonly string[] | null }[]>())
