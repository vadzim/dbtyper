// Integration Test: Enum type casting and complex scenarios
import { sqlMigrations } from "../../../src/core/sql-database.ts"

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

	// ✅ SUCCESS: Enum in GROUP BY
	const result = await db.query(`
		select task_status, count(*) as cnt
		from tasks
		group by task_status;
	`)

	return result
}

test()
