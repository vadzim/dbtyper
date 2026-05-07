// Integration Test: SELECT with CASE WHEN (searched form) - Multiple WHEN clauses
// Integration Test: SELECT with CASE WHEN (searched form)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
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

const _result = await _db.query(`
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
		typeof _result,
		{
			name: string
			age_group: string
		}[]
	>
>
