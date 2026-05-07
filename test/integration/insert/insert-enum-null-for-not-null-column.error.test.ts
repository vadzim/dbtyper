// Integration Test: INSERT with enum types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
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

// ❌ ERROR: NULL for NOT NULL enum column (caught at compile-time)
// ❌ ERROR: NULL for NOT NULL enum column (caught at compile-time)
const result = db.query(
	// @ts-expect-error
	`
		insert into tasks (id, name, task_status)
		values (7, 'Task 7', null)
		returning *;
	`,
)
