// Integration Test: SELECT with enum types - ✅ SUCCESS: Select with enum in IN clause
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
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
// ✅ SUCCESS: Select with enum in IN clause

const _result = await _db.query(`select * from tasks
		where task_status in ('active', 'pending');`)

type _check = Expect<
	Matches<typeof _result, { name: string; id: number; task_status: unknown; task_priority: unknown }[]>
>
