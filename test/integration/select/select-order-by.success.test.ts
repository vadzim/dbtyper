// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, age integer);`)
	.database()
// ✅ SUCCESS: ORDER BY
const result = await db.query(`select * from users order by age desc, name;`)
type _check = Expect<Matches<typeof result, Array<{ id: string; name: string; age: number }>>>
