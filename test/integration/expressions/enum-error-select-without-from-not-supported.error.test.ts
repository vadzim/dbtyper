// Integration Test: Enum error cases and edge cases
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
			task_priority priority,
			is_urgent boolean
		);`,
	)
	.database()

// Note: SELECT without FROM is not currently supported by the parser
const result = db.query(
	// @ts-expect-error
	`
		select 'invalid'::status;
	`,
)
