// Integration Test: Enum types across multiple schemas
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {
		text: "" as string,
		integer: 0 as number,
	},
}

async function testEnumAcrossSchemas() {
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

	// ✅ SUCCESS: Use enum from public schema
	const result1 = await db.query(`
		insert into public.tasks (id, task_status)
		values (1, 'active');
	`)

	// ✅ SUCCESS: Use enum from app schema
	const result2 = await db.query(`
		insert into app.articles (id, article_status, article_priority)
		values (1, 'draft', 'high');
	`)

	// ✅ SUCCESS: Query with schema-qualified enum
	const result3 = await db.query(`
		select * from public.tasks
		where task_status = 'active'::public.status;
	`)

	// ✅ SUCCESS: Query with schema-qualified enum in app schema
	const result4 = await db.query(`
		select * from app.articles
		where article_status = 'published'::app.status;
	`)

	// ✅ SUCCESS: Different enum types with same name in different schemas
	const result5 = await db.query(`
		select
			(select count(*) from public.tasks where task_status = 'active') as public_active,
			(select count(*) from app.articles where article_status = 'draft') as app_draft;
	`)

	// Note: Cross-schema enum comparisons would be runtime errors
	// These demonstrate that the type system allows them (as "unknown" types)
	// but PostgreSQL would reject them at runtime

	// Comparing enums from different schemas (runtime error)
	const runtime1 = await db.query(`
		select * from public.tasks t
		join app.articles a on t.task_status = a.article_status;
	`)

	return { result1, result2, result3, result4, result5, runtime1 }
}

testEnumAcrossSchemas()
