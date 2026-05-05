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

	// Comparing enums from different schemas (runtime error)
	const result = await db.query(`
		select * from public.tasks t
		join app.articles a on t.task_status = a.article_status;
	`)

	return result
}

test()
