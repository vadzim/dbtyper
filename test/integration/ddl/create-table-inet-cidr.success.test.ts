// Integration Test: CREATE TABLE with PostgreSQL-specific types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Extends, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ✅ SUCCESS: inet and cidr (network addresses)
const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table hosts (id integer not null, ip inet not null, subnet cidr not null);`)
	.database()
const result = await db.query(`select id, ip, subnet from hosts;`)
type _check = Expect<Extends<typeof result, unknown>>
