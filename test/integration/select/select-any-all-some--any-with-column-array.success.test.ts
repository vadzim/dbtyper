// Integration Test: SELECT with ANY/ALL/SOME operators - = ANY with column array
// Integration Test: ANY/ALL/SOME operators
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id integer not null, tags text[] not null, priority integer not null);`)
	.apply(`create table priorities (value integer not null);`)
	.database()
// ✅ SUCCESS: = ANY with column array

const _result = await _db.query(`select * from items where 'important' = any(tags);`)

type _check = Expect<
	Matches<
		typeof _result,
		{
			id: number
			tags: readonly string[]
			priority: number
		}[]
	>
>
