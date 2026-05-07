// Integration Test: SELECT with CASE WHEN (searched form) - CASE without ELSE (returns NULL)
// Integration Test: SELECT with CASE WHEN (searched form)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

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
// ✅ SUCCESS: CASE without ELSE (returns NULL)

const result = await db.query(`
		select
			name,
			case
				when active then 'yes'
			end as is_active
		from users;
	`)

type _check = Expect<
	Matches<
		typeof result,
		{
			name: string
			is_active: string
		}[]
	>
>
