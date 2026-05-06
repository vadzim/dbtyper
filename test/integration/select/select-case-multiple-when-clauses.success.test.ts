// Integration Test: SELECT with CASE WHEN (searched form) - Multiple WHEN clauses
// Integration Test: SELECT with CASE WHEN (searched form)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Extends, Matches } from "../../test-utils/type-test-utils.ts"

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
// ✅ SUCCESS: Multiple WHEN clauses

const result = await db.query(`
		select
			name,
			case
				when age < 13 then 'child'
				when age < 18 then 'teen'
				when age < 65 then 'adult'
				else 'senior'
			end as age_group
		from users;
	`)

type _check = Expect<
	Matches<
		typeof result,
		{
			name: string
			age_group: string
		}[]
	>
>
