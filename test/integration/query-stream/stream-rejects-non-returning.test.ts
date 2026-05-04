// Integration Test: db.stream() rejects non-RETURNING statements
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testStreamRejectsDeleteWithoutReturning() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ DELETE without RETURNING should be rejected by stream()
	// @ts-expect-error
	const stream = db.stream(`delete from users where id = '1';`)

	return stream
}

async function testStreamRejectsInsertWithoutReturning() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ INSERT without RETURNING should be rejected by stream()
	// @ts-expect-error
	const stream = db.stream(`insert into users (id, name) values ('1', 'Alice');`)

	return stream
}

async function testStreamRejectsUpdateWithoutReturning() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ UPDATE without RETURNING should be rejected by stream()
	// @ts-expect-error
	const stream = db.stream(`update users set name = 'Bob' where id = '1';`)

	return stream
}

async function testStreamAcceptsSelect() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SELECT should be accepted by stream()
	const stream = await db.stream(`select id, name from users;`)

	// Stream should yield typed objects
	for await (const row of stream) {
		type RowType = typeof row
		type _check = RowType extends { id: string; name: string } ? true : false
	}

	return stream
}

async function testStreamAcceptsReturning() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ DELETE with RETURNING should be accepted by stream()
	const stream = await db.stream(`delete from users where id = '1' returning id, name;`)

	// Stream should yield typed objects
	for await (const row of stream) {
		type RowType = typeof row
		type _check = RowType extends { id: string; name: string } ? true : false
	}

	return stream
}

testStreamRejectsDeleteWithoutReturning()
testStreamRejectsInsertWithoutReturning()
testStreamRejectsUpdateWithoutReturning()
testStreamAcceptsSelect()
testStreamAcceptsReturning()
