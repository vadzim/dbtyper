// Integration Test: SELECT with array operators - @> (contains) operator - already working
// Integration Test: Array operators
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id integer not null, tags text[] not null, nums integer[] not null);`)
	.database()
// ✅ SUCCESS: @> (contains) operator - already working

const _result = await db.query(`select tags @> array['a'] as contains from items;`)

type _check = Expect<
	Matches<
		typeof _result,
		{
			contains: boolean
		}[]
	>
>
