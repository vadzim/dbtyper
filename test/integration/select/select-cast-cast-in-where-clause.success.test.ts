// Integration Test: SELECT with type casts - Cast in WHERE clause
// Integration Test: PostgreSQL type casts (::type)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table data (id integer not null, value text not null, num integer not null);`)
	.database()
// ✅ SUCCESS: Cast in WHERE clause
const result = await db.query(`select * from data where id::text = '123';`)
type _check = Expect<Matches<typeof result, Array<{ id: number; value: string; num: number }>>>
