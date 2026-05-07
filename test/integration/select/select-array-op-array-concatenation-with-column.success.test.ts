// Integration Test: SELECT with array operators - Array concatenation with column
// Integration Test: Array operators
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id integer not null, tags text[] not null, nums integer[] not null);`)
	.database()
// ✅ SUCCESS: Array concatenation with column

const _result = await _db.query(`select tags || tags as doubled from items;`)

type _check = Expect<
	Matches<
		typeof _result,
		{
			doubled: readonly string[]
		}[]
	>
>
