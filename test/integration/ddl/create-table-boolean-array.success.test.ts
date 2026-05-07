// Integration Test: CREATE TABLE with array types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: boolean array

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table flags (id integer not null, bits boolean[] not null);`)
	.database()

const result = await db.query(`select id, bits from flags;`)

type _check = Expect<
	Matches<
		typeof result,
		{
			id: number
			bits: readonly boolean[]
		}[]
	>
>
