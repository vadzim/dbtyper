// Integration Test: SELECT with array operators - Multiple operators in WHERE
// Integration Test: Array operators
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id integer not null, tags text[] not null, nums integer[] not null);`)
	.database()
// ✅ SUCCESS: Multiple operators in WHERE

const result = await db.query(`select * from items where tags @> array['important'];`)

type _check = Expect<
	Matches<
		typeof result,
		{
		id: number
		tags: readonly string[]
		nums: readonly number[]
		}[]
	>
>
