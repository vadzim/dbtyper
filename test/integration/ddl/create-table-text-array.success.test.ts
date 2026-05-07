// Integration Test: CREATE TABLE with array types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: text array

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table tags (id integer not null, labels text[] not null);`)
	.database()

const result = await db.query(`select id, labels from tags;`)

type _check = Expect<
	Matches<
		typeof result,
		{
			id: number
			labels: unknown
		}[]
	>
>
