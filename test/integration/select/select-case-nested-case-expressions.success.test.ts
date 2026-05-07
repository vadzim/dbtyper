// Integration Test: SELECT with CASE WHEN (searched form) - Nested CASE expressions
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
// ✅ SUCCESS: Nested CASE expressions

const _result = await db.query(`
		select
			name,
			case
				when active then case
					when age >= 18 then 'active adult'
					else 'active minor'
				end
				else 'inactive'
			end as status
		from users;
	`)

type _check = Expect<
	Matches<
		typeof _result,
		Array<{
			name: string
			status: string
		}>
	>
>
