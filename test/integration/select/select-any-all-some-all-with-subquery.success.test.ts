// Integration Test: SELECT with ANY/ALL/SOME operators - ALL with subquery
// Integration Test: ANY/ALL/SOME operators
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id integer not null, tags text[] not null, priority integer not null);`)
	.apply(`create table priorities (value integer not null);`)
	.database()
// ✅ SUCCESS: ALL with subquery

const _result = await db.query(`select * from items where priority >= all(select value from priorities);`)

type _check = Expect<
	Matches<
		typeof result,
		{
			id: number
			tags: readonly string[]
			priority: number
		}[]
	>
>
