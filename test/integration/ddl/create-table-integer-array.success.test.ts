// Integration Test: CREATE TABLE with array types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: integer array

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table scores (id integer not null, nums integer[] not null);`)
	.database()

const _result = await _db.query(`select id, nums from scores;`)

type _check = Expect<
	Matches<
		typeof _result,
		{
			id: number
			nums: readonly number[]
		}[]
	>
>
