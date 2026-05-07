// Integration Test: SELECT with array operators - <@ (is contained by) operator
// Integration Test: Array operators
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id integer not null, tags text[] not null, nums integer[] not null);`)
	.database()
// ✅ SUCCESS: <@ (is contained by) operator

const _result = await db.query(`select tags <@ array['a','b','c'] as contained from items;`)

type _check = Expect<
	Matches<
		typeof _result,
		Array<{
			contained: boolean
		}>
	>
>
