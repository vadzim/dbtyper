// Integration Test: Enum error cases and edge cases
import { sqlMigrations } from "../../../src/core/sql-database.ts"
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
			task_priority priority,
			is_urgent boolean
		);`,
	)
	.database()

// ❌ ERROR: NULL for NOT NULL enum column (compile-time error)
const _result = _db.query(
	// @ts-expect-error
	`
		insert into tasks (id, name, task_status)
		values (2, 'Task', null);
	`,
)
