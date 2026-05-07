// Integration Test: SELECT with array functions - nested array functions
// Integration Test: Array functions
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id integer not null, tags text[] not null, nums integer[] not null);`)
	.database()
// ✅ SUCCESS: nested array functions

const _result = await db.query(`select array_length(array_append(tags, 'extra'), 1) as nested_len from items;`)

type _check = Expect<
	Matches<
		typeof _result,
		{
			nested_len: number
		}[]
	>
>
