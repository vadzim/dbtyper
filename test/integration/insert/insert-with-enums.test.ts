// Integration Test: INSERT with enum types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {
		text: "" as string,
		integer: 0 as number,
	},
}

async function testInsertWithEnums() {
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

	// ✅ SUCCESS: Insert with valid enum values
	const result1 = await db.query(`
		insert into tasks (id, name, task_status, task_priority)
		values (1, 'Task 1', 'active', 'high')
		returning *;
	`)

	// ✅ SUCCESS: Insert with valid enum value and NULL for nullable enum column
	const result2 = await db.query(`
		insert into tasks (id, name, task_status, task_priority)
		values (2, 'Task 2', 'pending', null)
		returning *;
	`)

	// ✅ SUCCESS: Insert with only required columns
	const result3 = await db.query(`
		insert into tasks (id, name, task_status)
		values (3, 'Task 3', 'inactive')
		returning *;
	`)

	// Note: The following would be runtime errors in PostgreSQL, but are not caught at compile-time
	// because enum types are treated as "unknown" in the type system, similar to how PostgreSQL
	// allows string literals to be compared with enums. Runtime validation would catch these.

	// Invalid enum value (runtime error, not compile-time)
	const result4 = await db.query(`
		insert into tasks (id, name, task_status)
		values (4, 'Task 4', 'invalid_status')
		returning *;
	`)

	// Wrong enum type (runtime error, not compile-time)
	const result5 = await db.query(`
		insert into tasks (id, name, task_status)
		values (5, 'Task 5', 'high')
		returning *;
	`)

	// Integer value for enum column (runtime error, not compile-time)
	const result6 = await db.query(`
		insert into tasks (id, name, task_status)
		values (6, 'Task 6', 123)
		returning *;
	`)

	// ❌ ERROR: NULL for NOT NULL enum column (caught at compile-time)
	// @ts-expect-error
	const result7 = await db.query(`
		insert into tasks (id, name, task_status)
		values (7, 'Task 7', null)
		returning *;
	`)

	return { result1, result2, result3, result4, result5, result6, result7 }
}

testInsertWithEnums()
