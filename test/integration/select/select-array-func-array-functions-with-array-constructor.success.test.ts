// Integration Test: SELECT with array functions - array functions with ARRAY constructor
// Integration Test: Array functions
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Extends, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id integer not null, tags text[] not null, nums integer[] not null);`)
	.database()
// ✅ SUCCESS: array functions with ARRAY constructor
const result = await db.query(`select array_length(array['a','b','c'], 1) as literal_len from items;`)
type _check = Expect<Extends<typeof result, unknown[]>>
