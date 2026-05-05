// Integration Test: Enum types across multiple schemas
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
		.apply(`create schema app;`)
		.apply(`create type public.status as enum ('active', 'inactive');`)
		.apply(`create type app.status as enum ('draft', 'published');`)
		.apply(`create type app.priority as enum ('low', 'high');`)
		.apply(`create table public.tasks (
			id integer not null,
			task_status status not null
		);`)
		.apply(`create table app.articles (
			id integer not null,
			article_status status not null,
			article_priority priority
		);`)
		.database()

	// ✅ SUCCESS: Query with schema-qualified enum
	const result = await db.query(`
		select * from public.tasks
		where task_status = 'active'::public.status;
	`)

	return result
}

test()
