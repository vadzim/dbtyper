// Integration Test: CREATE TABLE with PostgreSQL-specific types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: interval (time intervals)

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table durations (id integer not null, duration interval not null);`)
	.database()

const _result = await _db.query(`select id, duration from durations;`)

expectType<typeof _result>(
	toBe<
		{
			id: number
			duration: unknown
		}[]
	>(),
)
