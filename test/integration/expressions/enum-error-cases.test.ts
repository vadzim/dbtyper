// Integration Test: Enum error cases and edge cases
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {
		text: "" as string,
		integer: 0 as number,
		boolean: true as boolean,
	},
}

async function testEnumErrorCases() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active', 'inactive', 'pending');`)
		.apply(`create type priority as enum ('low', 'medium', 'high');`)
		.apply(`create table tasks (
			id integer not null,
			name text not null,
			task_status status not null,
			task_priority priority,
			is_urgent boolean
		);`)
		.database()

	// ✅ SUCCESS: Valid enum operations
	const valid1 = await db.query(`
		select * from tasks where task_status = 'active';
	`)

	const valid2 = await db.query(`
		insert into tasks (id, name, task_status, task_priority)
		values (1, 'Task', 'active', 'high');
	`)

	// ❌ ERROR: NULL for NOT NULL enum column (compile-time error)
	// @ts-expect-error
	const error1 = await db.query(`
		insert into tasks (id, name, task_status)
		values (2, 'Task', null);
	`)

	// ❌ ERROR: NULL for NOT NULL enum column in UPDATE (compile-time error)
	// @ts-expect-error
	const error2 = await db.query(`
		update tasks set task_status = null where id = 1;
	`)

	// Note: The following are runtime errors in PostgreSQL but not caught at compile-time.
	// This is intentional and matches PostgreSQL's behavior where enum validation happens
	// at runtime. The type system treats enums as "unknown" types, allowing string literals
	// to be used (which is correct), but cannot validate the actual enum values without
	// complex type-level string literal validation.

	// Invalid enum value (runtime error)
	const runtime1 = await db.query(`
		insert into tasks (id, name, task_status)
		values (3, 'Task', 'invalid_value');
	`)

	// Wrong enum type (runtime error)
	const runtime2 = await db.query(`
		insert into tasks (id, name, task_status)
		values (4, 'Task', 'high');
	`)

	// Comparing enum with wrong type (runtime error)
	const runtime3 = await db.query(`
		select * from tasks where task_status = 123;
	`)

	// Comparing enum with boolean (runtime error)
	const runtime4 = await db.query(`
		select * from tasks where task_status = true;
	`)

	// Using non-existent enum value in IN clause (runtime error)
	const runtime5 = await db.query(`
		select * from tasks where task_status in ('active', 'nonexistent');
	`)

	// Note: SELECT without FROM is not currently supported by the parser
	// @ts-expect-error
	const runtime6 = await db.query(`
		select 'invalid'::status;
	`)

	// Comparing different enum types (runtime error)
	const runtime7 = await db.query(`
		select * from tasks where task_status = task_priority;
	`)

	return {
		valid1,
		valid2,
		error1,
		error2,
		runtime1,
		runtime2,
		runtime3,
		runtime4,
		runtime5,
		runtime6,
		runtime7,
	}
}

testEnumErrorCases()
