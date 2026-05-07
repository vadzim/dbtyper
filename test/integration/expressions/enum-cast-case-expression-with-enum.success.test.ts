// Integration Test: Enum type casting and complex scenarios
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create type status as enum ('active', 'inactive', 'pending');`)
	.apply(`create type priority as enum ('low', 'medium', 'high');`)
	.apply(
		`create table tasks (
			id integer not null,
			name text not null,
			task_status status not null,
			task_priority priority
		);`,
	)
	.database()
// ✅ SUCCESS: CASE expression with enum

const _result = await db.query(`
		select
			id,
			case task_status
				when 'active' then 'Running'
				when 'pending' then 'Waiting'
				else 'Stopped'
			end as status_label
		from tasks;
	`)

type _check = Expect<
	Matches<
		typeof result,
		Array<{
			id: number
			status_label: string
		}>
	>
>
