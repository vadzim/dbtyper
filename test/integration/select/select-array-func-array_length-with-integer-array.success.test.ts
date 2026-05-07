// Integration Test: SELECT with array functions - array_length with integer array
// Integration Test: Array functions
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id integer not null, tags text[] not null, nums integer[] not null);`)
	.database()
// ✅ SUCCESS: array_length with integer array

const _result = await db.query(`select array_length(nums, 1) as num_len from items;`)

type _check = Expect<
	Matches<
		typeof result,
		Array<{
			num_len: number
		}>
	>
>
