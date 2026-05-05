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
	.apply(`create table users (id text, age integer, active boolean);`)
	.database()
// ✅ SUCCESS: WHERE with AND/OR
const result = await db.query(`select * from users where (age > 18 and active = true) or id = 'admin';`)
type _check = Expect<Matches<typeof result, Array<{ id: string; age: number; active: boolean }>>>
