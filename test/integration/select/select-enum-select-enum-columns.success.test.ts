// Integration Test: SELECT with enum types - ✅ SUCCESS: Select enum columns
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {
		text: "" as string,
		integer: 0 as number,
	},
}

async function test() {
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

	// ✅ SUCCESS: Select enum columns
	const result = await db.query(`select id, task_status, task_priority from tasks;`)

	return result
}

test()
