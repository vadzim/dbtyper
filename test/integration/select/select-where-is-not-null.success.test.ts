// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()
// ✅ SUCCESS: WHERE column IS NOT NULL

const result = await db.query(`select * from users where name is not null;`)

type _check = Expect<
	Matches<
		typeof result,
		Array<{
			id: string
			name: string
		}>
	>
>
