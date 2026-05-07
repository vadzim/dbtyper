// Integration Test: SELECT with array functions - array_append with integer array
// Integration Test: Array functions
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id integer not null, tags text[] not null, nums integer[] not null);`)
	.database()
// ✅ SUCCESS: array_append with integer array

const result = await db.query(`select array_append(nums, 42) as nums_appended from items;`)

type _check = Expect<
	Matches<
		typeof result,
		{
			nums_appended: unknown
		}[]
	>
>
