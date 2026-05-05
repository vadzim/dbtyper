// Integration Test: CREATE TABLE with PostgreSQL-specific types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Extends, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ✅ SUCCESS: interval (time intervals)
const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table durations (id integer not null, duration interval not null);`)
	.database()
const result = await db.query(`select id, duration from durations;`)
type _check = Expect<Matches<typeof result, { id: number; duration: unknown }[]>>
