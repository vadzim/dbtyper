// Integration Test: DELETE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, email text);`)
	.database()

// ✅ SUCCESS: RETURNING specific columns

const result = await db.query(`delete from users returning id, name;`)

type _check = Expect<
	Matches<
		typeof result,
		Array<{
			id: string
			name: string
		}>
	>
>
