// Integration Test: INSERT with enum types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
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
// ✅ SUCCESS: Insert with valid enum values
// ✅ SUCCESS: Insert with valid enum values

const result = await db.query(`
		insert into tasks (id, name, task_status, task_priority)
		values (1, 'Task 1', 'active', 'high')
		returning *;
	`)

type _check = Expect<
	Matches<typeof result, { name: string; id: number; task_status: unknown; task_priority: unknown }[]>
>
