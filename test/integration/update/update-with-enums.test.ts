// Integration Test: UPDATE with enum types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {
		text: "" as string,
		integer: 0 as number,
	},
}

async function testUpdateWithEnums() {
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

	// ✅ SUCCESS: Update with valid enum value
	const result1 = await db.query(`
		update tasks
		set task_status = 'active'
		where id = 1;
	`)

	// ✅ SUCCESS: Update multiple enum columns
	const result2 = await db.query(`
		update tasks
		set task_status = 'pending', task_priority = 'high'
		where id = 2;
	`)

	// ✅ SUCCESS: Update enum to NULL (for nullable column)
	const result3 = await db.query(`
		update tasks
		set task_priority = null
		where id = 3;
	`)

	// Note: The following would be runtime errors in PostgreSQL, but are not caught at compile-time
	// because enum types are treated as "unknown" in the type system, similar to how PostgreSQL
	// allows string literals to be compared with enums. Runtime validation would catch these.

	// Invalid enum value (runtime error, not compile-time)
	const result4 = await db.query(`
		update tasks
		set task_status = 'invalid_status'
		where id = 4;
	`)

	// Wrong enum type (runtime error, not compile-time)
	const result5 = await db.query(`
		update tasks
		set task_status = 'high'
		where id = 5;
	`)

	// ❌ ERROR: NULL for NOT NULL enum column (caught at compile-time)
	// @ts-expect-error
	const result6 = await db.query(`
		update tasks
		set task_status = null
		where id = 6;
	`)

	return { result1, result2, result3, result4, result5, result6 }
}

testUpdateWithEnums()
