// Integration Test: CREATE TABLE with array types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Extends, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ✅ SUCCESS: uuid array

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table refs (id integer not null, uuids uuid[] not null);`)
	.database()

const result = await db.query(`select id, uuids from refs;`)

type _check = Expect<
	Matches<
		typeof result,
		{
			id: number
			uuids: unknown
		}[]
	>
>
