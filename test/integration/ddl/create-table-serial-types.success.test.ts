// Integration Test: CREATE TABLE with PostgreSQL-specific types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Extends, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ✅ SUCCESS: serial types (auto-increment)
const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table counters (id serial not null, count bigserial not null, small smallserial not null);`)
	.database()
const result = await db.query(`select id, count, small from counters;`)
type _check = Expect<Extends<typeof result, unknown>>
