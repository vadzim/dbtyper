// Integration Test: DELETE edge cases
// Tests for NULL handling, type validation, and various DELETE scenarios

import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

// ============================================================================
// Basic DELETE tests
// ============================================================================

async function testDeleteWithWhere() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: DELETE with WHERE
	const result = await db.query(`delete from users where id = '1' returning *;`)

	return result
}

async function testDeleteWithoutWhere() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: DELETE without WHERE (deletes all rows)
	const result = await db.query(`delete from users returning *;`)

	return result
}

async function testDeleteWithComplexWhere() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, age integer);`)
		.database()

	// ✅ SUCCESS: DELETE with complex WHERE
	const result = await db.query(`delete from users where age < 18 or name is null returning *;`)

	return result
}

// ============================================================================
// Type validation tests
// ============================================================================

async function testDeleteWhereTypeMismatch() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, age integer);`)
		.database()

	// ❌ ERROR: WHERE clause type mismatch
	const bad = await db.query(
		// @ts-expect-error
		`delete from users where age = 'not a number' returning *;`,
	)

	return bad
}

async function testDeleteWhereCorrectTypes() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, age integer, active boolean);`)
		.database()

	// ✅ SUCCESS: correct types in WHERE
	const result = await db.query(`delete from users where age > 65 and active = false returning *;`)

	return result
}

// ============================================================================
// Column validation tests
// ============================================================================

async function testDeleteWhereUnknownColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: unknown column in WHERE
	const bad = await db.query(
		// @ts-expect-error
		`delete from users where invalid_column = '1' returning *;`,
	)

	return bad
}

async function testDeleteUnknownTable() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: unknown table
	const bad = await db.query(
		// @ts-expect-error
		`delete from nonexistent where id = '1' returning *;`,
	)

	return bad
}

// ============================================================================
// RETURNING clause tests
// ============================================================================

async function testDeleteReturningAll() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ✅ SUCCESS: RETURNING *
	const result = await db.query(`delete from users where id = '1' returning *;`)

	// Type should be: Array<{ id: string; name: string; email: string }>
	const _typeCheck: typeof result = [] as Array<{
		id: string
		name: string
		email: string
	}>

	return result
}

async function testDeleteReturningSpecificColumns() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ✅ SUCCESS: RETURNING specific columns
	const result = await db.query(`delete from users where id = '1' returning id, name;`)

	// Type should be: Array<{ id: string; name: string }>
	const _typeCheck: typeof result = [] as Array<{
		id: string
		name: string
	}>

	return result
}

async function testDeleteReturningUnknownColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: RETURNING unknown column
	const bad = await db.query(
		// @ts-expect-error
		`delete from users where id = '1' returning invalid_column;`,
	)

	return bad
}

// ============================================================================
// DELETE with USING clause (PostgreSQL-specific)
// ============================================================================

async function testDeleteWithUsing() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table banned (user_id text);`)
		.database()

	// ✅ SUCCESS: DELETE with USING clause
	const result = await db.query(`delete from users using banned where users.id = banned.user_id returning users.*;`)

	return result
}

// ============================================================================
// NULL handling in WHERE clause
// ============================================================================

async function testDeleteWhereIsNull() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: WHERE column IS NULL
	const result = await db.query(`delete from users where name is null returning *;`)

	return result
}

async function testDeleteWhereIsNotNull() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: WHERE column IS NOT NULL
	const result = await db.query(`delete from users where name is not null returning *;`)

	return result
}

// Run all tests
testDeleteWithWhere()
testDeleteWithoutWhere()
testDeleteWithComplexWhere()
testDeleteWhereTypeMismatch()
testDeleteWhereCorrectTypes()
testDeleteWhereUnknownColumn()
testDeleteUnknownTable()
testDeleteReturningAll()
testDeleteReturningSpecificColumns()
testDeleteReturningUnknownColumn()
testDeleteWithUsing()
testDeleteWhereIsNull()
testDeleteWhereIsNotNull()
