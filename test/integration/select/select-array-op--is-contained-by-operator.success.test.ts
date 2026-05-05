// Integration Test: SELECT with array operators - <@ (is contained by) operator
// Integration Test: Array operators
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id integer not null, tags text[] not null, nums integer[] not null);`)
	.database()
// ✅ SUCCESS: <@ (is contained by) operator
const result = await db.query(`select tags <@ array['a','b','c'] as contained from items;`)
type _check = Expect<Matches<typeof result, Array<{ contained: boolean }>>>
