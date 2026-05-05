// Integration Test: CREATE TABLE with array types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Extends, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ✅ SUCCESS: boolean array
const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table flags (id integer not null, bits boolean[] not null);`)
	.database()
const result = await db.query(`select id, bits from flags;`)
type _check = Expect<Matches<typeof result, { id: number; bits: unknown; }[]>>
