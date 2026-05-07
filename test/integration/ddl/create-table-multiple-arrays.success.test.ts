// Integration Test: CREATE TABLE with array types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: multiple array columns

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table multi (id integer not null, tags text[] not null, scores integer[] not null, flags boolean[] not null);`,
	)
	.database()

const result = await db.query(`select id, tags, scores, flags from multi;`)

type _check = Expect<
	Matches<
		typeof result,
		{
			id: number
			tags: readonly string[]
			flags: readonly boolean[]
			scores: readonly number[]
		}[]
	>
>
