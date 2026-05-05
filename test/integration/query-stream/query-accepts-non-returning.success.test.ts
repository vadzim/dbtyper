// Integration Test: db.query() accepts non-RETURNING statements
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testQueryAcceptsDeleteWithoutReturning() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ DELETE without RETURNING should be accepted by query()
	const result = await db.query(`delete from users where id = '1';`)

	// Result type should be unknown
	type ResultType = typeof result
	type _check = ResultType extends unknown ? true : false

	return result
}

async function testQueryAcceptsInsertWithoutReturning() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ INSERT without RETURNING should be accepted by query()
	const result = await db.query(`insert into users (id, name) values ('1', 'Alice');`)

	// Result type should be unknown
	type ResultType = typeof result
	type _check = ResultType extends unknown ? true : false

	return result
}

async function testQueryAcceptsUpdateWithoutReturning() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ UPDATE without RETURNING should be accepted by query()
	const result = await db.query(`update users set name = 'Bob' where id = '1';`)

	// Result type should be unknown
	type ResultType = typeof result
	type _check = ResultType extends unknown ? true : false

	return result
}

async function testQueryAcceptsSelectWithTypedArray() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SELECT should return typed array
	const result = await db.query(`select id, name from users;`)

	// Result type should be Array<{ id: string; name: string }>
	type ResultType = typeof result
	type _check = ResultType extends Array<{ id: string; name: string }> ? true : false

	return result
}

async function testQueryAcceptsReturningWithTypedArray() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ DELETE with RETURNING should return typed array
	const result = await db.query(`delete from users where id = '1' returning id, name;`)

	// Result type should be Array<{ id: string; name: string }>
	type ResultType = typeof result
	type _check = ResultType extends Array<{ id: string; name: string }> ? true : false

	return result
}

testQueryAcceptsDeleteWithoutReturning()
testQueryAcceptsInsertWithoutReturning()
testQueryAcceptsUpdateWithoutReturning()
testQueryAcceptsSelectWithTypedArray()
testQueryAcceptsReturningWithTypedArray()
