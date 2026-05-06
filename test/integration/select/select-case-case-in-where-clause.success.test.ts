// Integration Test: SELECT with CASE WHEN (searched form) - CASE in WHERE clause
// Integration Test: SELECT with CASE WHEN (searched form)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table users (
				id text not null,
				name text not null,
				age integer not null,
				active boolean not null
			);`,
	)
	.database()
// ✅ SUCCESS: CASE in WHERE clause

const result = await db.query(`
		select * from users
		where case
			when age < 18 then false
			else true
		end;
	`)

type _check = Expect<
	Matches<
		typeof result,
		Array<{
			id: string
			name: string
			age: number
			active: boolean
		}>
	>
>
