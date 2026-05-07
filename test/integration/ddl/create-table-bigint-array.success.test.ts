// Integration Test: CREATE TABLE with array types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: bigint array

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table big_nums (id integer not null, nums bigint[] not null);`)
	.database()

const result = await db.query(`select id, nums from big_nums;`)

type _check = Expect<
	Matches<
		typeof result,
		{
			id: number
			nums: unknown
		}[]
	>
>
