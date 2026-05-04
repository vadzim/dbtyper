// Integration Test: INSERT edge cases
// Tests for NULL handling, type validation, and various INSERT scenarios

import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

// ============================================================================
// Basic INSERT tests
// ============================================================================

async function testInsertWithValues() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ✅ SUCCESS: INSERT with VALUES
	const result = await db.query(
		`insert into users (id, name, email) values ('1', 'Alice', 'alice@example.com') returning *;`,
	)

	return result
}

async function testInsertWithSelect() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table users_backup (id text, name text);`)
		.database()

	// ✅ SUCCESS: INSERT with SELECT
	const result = await db.query(`insert into users_backup (id, name) select id, name from users;`)

	return result
}

async function testInsertMultipleRows() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: INSERT multiple rows
	const result = await db.query(
		`insert into users (id, name) values ('1', 'Alice'), ('2', 'Bob'), ('3', 'Charlie') returning *;`,
	)

	return result
}

// ============================================================================
// NULL handling tests
// ============================================================================

async function testInsertNullIntoNullableColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: NULL into nullable column
	const result = await db.query(`insert into users (id, name) values ('1', null) returning *;`)

	return result
}

async function testInsertNullIntoNotNullColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text not null, name text);`)
		.database()

	// ❌ ERROR: NULL into NOT NULL column
	const bad = await db.query(
		// @ts-expect-error
		`insert into users (id, name) values (null, 'Alice') returning *;`,
	)

	return bad
}

async function testInsertMissingNotNullColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text not null, name text);`)
		.database()

	// ❌ ERROR: missing NOT NULL column
	const bad = await db.query(
		// @ts-expect-error
		`insert into users (name) values ('Alice') returning *;`,
	)

	return bad
}

async function testInsertMissingNullableColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: missing nullable column (implicitly NULL)
	const result = await db.query(`insert into users (id) values ('1') returning *;`)

	return result
}

// ============================================================================
// Type validation tests
// ============================================================================

async function testInsertTypeMismatch() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, age integer);`)
		.database()

	// ❌ ERROR: type mismatch (text instead of integer)
	const bad = await db.query(
		// @ts-expect-error
		`insert into users (id, age) values ('1', 'not a number') returning *;`,
	)

	return bad
}

async function testInsertCorrectTypes() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, age integer, active boolean);`)
		.database()

	// ✅ SUCCESS: correct types
	const result = await db.query(`insert into users (id, age, active) values ('1', 25, true) returning *;`)

	return result
}

// ============================================================================
// Column validation tests
// ============================================================================

async function testInsertUnknownColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: unknown column
	const bad = await db.query(
		// @ts-expect-error
		`insert into users (id, invalid_column) values ('1', 'value') returning *;`,
	)

	return bad
}

async function testInsertUnknownTable() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: unknown table
	const bad = await db.query(
		// @ts-expect-error
		`insert into nonexistent (id) values ('1') returning *;`,
	)

	return bad
}

// ============================================================================
// RETURNING clause tests
// ============================================================================

async function testInsertReturningAll() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ✅ SUCCESS: RETURNING *
	const result = await db.query(
		`insert into users (id, name, email) values ('1', 'Alice', 'alice@example.com') returning *;`,
	)

	// Type should be: Array<{ id: string; name: string; email: string }>
	const _typeCheck: typeof result = [] as Array<{
		id: string
		name: string
		email: string
	}>

	return result
}

async function testInsertReturningSpecificColumns() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ✅ SUCCESS: RETURNING specific columns
	const result = await db.query(
		`insert into users (id, name, email) values ('1', 'Alice', 'alice@example.com') returning id, name;`,
	)

	// Type should be: Array<{ id: string; name: string }>
	const _typeCheck: typeof result = [] as Array<{
		id: string
		name: string
	}>

	return result
}

async function testInsertReturningUnknownColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: RETURNING unknown column
	const bad = await db.query(
		// @ts-expect-error
		`insert into users (id, name) values ('1', 'Alice') returning invalid_column;`,
	)

	return bad
}

// Run all tests
testInsertWithValues()
testInsertWithSelect()
testInsertMultipleRows()
testInsertNullIntoNullableColumn()
testInsertNullIntoNotNullColumn()
testInsertMissingNotNullColumn()
testInsertMissingNullableColumn()
testInsertTypeMismatch()
testInsertCorrectTypes()
testInsertUnknownColumn()
testInsertUnknownTable()
testInsertReturningAll()
testInsertReturningSpecificColumns()
testInsertReturningUnknownColumn()
