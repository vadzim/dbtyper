// Integration Test: SELECT with array operators - Array equality in WHERE
// Integration Test: Array operators
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
// ✅ SUCCESS: Array equality in WHERE

const result = await db.query(`select * from items where tags = array['a','b'];`)

type _check = Expect<
	Matches<
		typeof result,
		{
			id: number
			tags: unknown
			nums: unknown
		}[]
	>
>
