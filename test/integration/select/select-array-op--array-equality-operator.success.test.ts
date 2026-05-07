// Integration Test: SELECT with array operators - = (array equality) operator
// Integration Test: Array operators
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id integer not null, tags text[] not null, nums integer[] not null);`)
	.database()
// ✅ SUCCESS: = (array equality) operator

const _result = await _db.query(`select tags = array['a','b'] as equals from items;`)

type _check = Expect<
	Matches<
		typeof _result,
		Array<{
			equals: boolean
		}>
	>
>
