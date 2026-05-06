// Integration Test: SELECT with ANY/ALL/SOME operators - <> ANY with array
// Integration Test: ANY/ALL/SOME operators
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Extends, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id integer not null, tags text[] not null, priority integer not null);`)
	.apply(`create table priorities (value integer not null);`)
	.database()
// ✅ SUCCESS: <> ANY with array

const result = await db.query(`select * from items where id <> any(array[1,2,3]);`)

type _check = Expect<
	Matches<
		typeof result,
		{
			id: number
			tags: unknown
			priority: number
		}[]
	>
>
