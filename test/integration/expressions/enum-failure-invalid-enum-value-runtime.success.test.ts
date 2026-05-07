// Integration Test: Enum failure cases and edge cases
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
			task_priority priority,
			is_urgent boolean
		);`,
	)
	.database()
// Invalid enum value (runtime failure)

const result = await db.query(`
		insert into tasks (id, name, task_status)
		values (3, 'Task', 'invalid_value');
	`)

type _check = Expect<Matches<typeof result, unknown>>
