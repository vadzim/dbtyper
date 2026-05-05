// Integration Test: SELECT with enum types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {
		text: "" as string,
		integer: 0 as number,
	},
}

async function testSelectWithEnums() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active', 'inactive', 'pending');`)
		.apply(`create type priority as enum ('low', 'medium', 'high');`)
		.apply(`create table tasks (
			id integer not null,
			name text not null,
			task_status status not null,
			task_priority priority
		);`)
		.database()

	// ✅ SUCCESS: Select with enum column in WHERE clause
	const result1 = await db.query(`
		select * from tasks
		where task_status = 'active';
	`)

	// ✅ SUCCESS: Select with multiple enum conditions
	const result2 = await db.query(`
		select * from tasks
		where task_status = 'pending' and task_priority = 'high';
	`)

	// ✅ SUCCESS: Select with enum in OR condition
	const result3 = await db.query(`
		select * from tasks
		where task_status = 'active' or task_status = 'pending';
	`)

	// ✅ SUCCESS: Select with enum IS NULL
	const result4 = await db.query(`
		select * from tasks
		where task_priority is null;
	`)

	// ✅ SUCCESS: Select with enum IS NOT NULL
	const result5 = await db.query(`
		select * from tasks
		where task_priority is not null;
	`)

	// ✅ SUCCESS: Select with enum in IN clause
	const result6 = await db.query(`
		select * from tasks
		where task_status in ('active', 'pending');
	`)

	// ✅ SUCCESS: Select enum columns
	const result7 = await db.query(`
		select id, task_status, task_priority from tasks;
	`)

	// Note: The following would be runtime errors in PostgreSQL, but are not caught at compile-time
	// because enum types are treated as "unknown" in the type system, similar to how PostgreSQL
	// allows string literals to be compared with enums. Runtime validation would catch these.

	// Invalid enum value in WHERE (runtime error, not compile-time)
	const result8 = await db.query(`
		select * from tasks
		where task_status = 'invalid_status';
	`)

	// Wrong enum type in comparison (runtime error, not compile-time)
	const result9 = await db.query(`
		select * from tasks
		where task_status = 'high';
	`)

	// Comparing enum with integer (runtime error, not compile-time)
	const result10 = await db.query(`
		select * from tasks
		where task_status = 123;
	`)

	// Invalid enum value in IN clause (runtime error, not compile-time)
	const result11 = await db.query(`
		select * from tasks
		where task_status in ('active', 'invalid');
	`)

	return { result1, result2, result3, result4, result5, result6, result7, result8, result9, result10, result11 }
}

testSelectWithEnums()
