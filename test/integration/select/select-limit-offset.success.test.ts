// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()
// ✅ SUCCESS: LIMIT with OFFSET (pagination)

const _result = await db.query(`select * from users limit 10 offset 20;`)

type _check = Expect<
	Matches<
		typeof _result,
		Array<{
			id: string
			name: string
		}>
	>
>
