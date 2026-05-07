// Integration Test: SELECT with enum types - ✅ SUCCESS: Select with enum in OR condition
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
// ✅ SUCCESS: Select with enum in OR condition

const _result = await db.query(`select * from tasks
		where task_status = 'active' or task_status = 'pending';`)

type _check = Expect<
	Matches<typeof _result, { name: string; id: number; task_status: unknown; task_priority: unknown }[]>
>
