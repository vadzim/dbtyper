// Integration Test: UPDATE edge cases
// Tests for NULL handling, type validation, and various UPDATE scenarios

import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

// ============================================================================
// Basic UPDATE tests
// ============================================================================

async function testUpdateSingleColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ✅ SUCCESS: UPDATE single column
	const result = await db.query(`update users set name = 'Alice' where id = '1' returning *;`)

	return result
}

async function testUpdateMultipleColumns() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ✅ SUCCESS: UPDATE multiple columns
	const result = await db.query(
		`update users set name = 'Alice', email = 'alice@example.com' where id = '1' returning *;`,
	)

	return result
}

async function testUpdateWithoutWhere() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: UPDATE without WHERE (updates all rows)
	const result = await db.query(`update users set name = 'Everyone' returning *;`)

	return result
}

async function testUpdateWithComplexWhere() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, age integer);`)
		.database()

	// ✅ SUCCESS: UPDATE with complex WHERE
	const result = await db.query(`update users set name = 'Adult' where age >= 18 returning *;`)

	return result
}

// ============================================================================
// NULL handling tests
// ============================================================================

async function testUpdateSetNullIntoNullableColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: SET NULL into nullable column
	const result = await db.query(`update users set name = null where id = '1' returning *;`)

	return result
}

async function testUpdateSetNullIntoNotNullColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text not null, name text);`)
		.database()

	// ❌ ERROR: SET NULL into NOT NULL column
	const bad = await db.query(
		// @ts-expect-error
		`update users set id = null where name = 'Alice' returning *;`,
	)

	return bad
}

// ============================================================================
// Type validation tests
// ============================================================================

async function testUpdateTypeMismatch() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, age integer);`)
		.database()

	// ❌ ERROR: type mismatch (text instead of integer)
	const bad = await db.query(
		// @ts-expect-error
		`update users set age = 'not a number' where id = '1' returning *;`,
	)

	return bad
}

async function testUpdateCorrectTypes() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, age integer, active boolean);`)
		.database()

	// ✅ SUCCESS: correct types
	const result = await db.query(`update users set age = 30, active = false where id = '1' returning *;`)

	return result
}

async function testUpdateWhereTypeMismatch() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, age integer);`)
		.database()

	// ❌ ERROR: WHERE clause type mismatch
	const bad = await db.query(
		// @ts-expect-error
		`update users set name = 'Alice' where age = 'not a number' returning *;`,
	)

	return bad
}

// ============================================================================
// Column validation tests
// ============================================================================

async function testUpdateUnknownColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: unknown column in SET
	const bad = await db.query(
		// @ts-expect-error
		`update users set invalid_column = 'value' where id = '1' returning *;`,
	)

	return bad
}

async function testUpdateWhereUnknownColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: unknown column in WHERE
	const bad = await db.query(
		// @ts-expect-error
		`update users set name = 'Alice' where invalid_column = '1' returning *;`,
	)

	return bad
}

async function testUpdateUnknownTable() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: unknown table
	const bad = await db.query(
		// @ts-expect-error
		`update nonexistent set name = 'Alice' where id = '1' returning *;`,
	)

	return bad
}

// ============================================================================
// RETURNING clause tests
// ============================================================================

async function testUpdateReturningAll() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ✅ SUCCESS: RETURNING *
	const result = await db.query(`update users set name = 'Alice' where id = '1' returning *;`)

	// Type should be: Array<{ id: string; name: string; email: string }>
	const _typeCheck: typeof result = [] as Array<{
		id: string
		name: string
		email: string
	}>

	return result
}

async function testUpdateReturningSpecificColumns() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ✅ SUCCESS: RETURNING specific columns
	const result = await db.query(`update users set name = 'Alice' where id = '1' returning id, name;`)

	// Type should be: Array<{ id: string; name: string }>
	const _typeCheck: typeof result = [] as Array<{
		id: string
		name: string
	}>

	return result
}

async function testUpdateReturningUnknownColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: RETURNING unknown column
	const bad = await db.query(
		// @ts-expect-error
		`update users set name = 'Alice' where id = '1' returning invalid_column;`,
	)

	return bad
}

// ============================================================================
// UPDATE with FROM clause (PostgreSQL-specific)
// ============================================================================

async function testUpdateWithFrom() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text, title text);`)
		.database()

	// ✅ SUCCESS: UPDATE with FROM clause
	const result = await db.query(
		`update users set name = 'Author' from posts where users.id = posts.user_id returning users.*;`,
	)

	return result
}

// Run all tests
testUpdateSingleColumn()
testUpdateMultipleColumns()
testUpdateWithoutWhere()
testUpdateWithComplexWhere()
testUpdateSetNullIntoNullableColumn()
testUpdateSetNullIntoNotNullColumn()
testUpdateTypeMismatch()
testUpdateCorrectTypes()
testUpdateWhereTypeMismatch()
testUpdateUnknownColumn()
testUpdateWhereUnknownColumn()
testUpdateUnknownTable()
testUpdateReturningAll()
testUpdateReturningSpecificColumns()
testUpdateReturningUnknownColumn()
testUpdateWithFrom()
