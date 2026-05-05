// Integration Test: CREATE TABLE with array types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Extends, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ✅ SUCCESS: bigint array
const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table big_nums (id integer not null, nums bigint[] not null);`)
	.database()
const result = await db.query(`select id, nums from big_nums;`)
type _check = Expect<Matches<typeof result, { id: number; nums: unknown }[]>>
