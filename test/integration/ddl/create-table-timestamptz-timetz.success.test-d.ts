// Integration Test: CREATE TABLE with PostgreSQL-specific types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: timestamptz and timetz aliases

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table events (created_at timestamptz not null, time_only timetz not null);`)
	.database()

const _result = await _db.query(`select created_at, time_only from events;`)

expectType<typeof _result>(
	toBe<
		{
			created_at: unknown
			time_only: unknown
		}[]
	>(),
)
