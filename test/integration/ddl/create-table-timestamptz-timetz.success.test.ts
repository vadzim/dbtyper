// Integration Test: CREATE TABLE with PostgreSQL-specific types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: timestamptz and timetz aliases

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table events (created_at timestamptz not null, time_only timetz not null);`)
	.database()

const result = await db.query(`select created_at, time_only from events;`)

type _check = Expect<
	Matches<
		typeof result,
		{
			created_at: unknown
			time_only: unknown
		}[]
	>
>
