// Integration Test: Advanced SELECT features
// Tests for SELECT *, aliases, qualified tables

import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testSelectStar() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ✅ SUCCESS: SELECT * should expand to all columns
	const result = await db.query(`select * from users;`)

	// Type should be: Array<{ id: string; name: string; email: string }>
	const _typeCheck: typeof result = [] as Array<{
		id: string
		name: string
		email: string
	}>

	return result
}

async function testColumnAliases() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: column aliases should work
	const result = await db.query(`select id as user_id, name as user_name from users;`)

	// Type should be: Array<{ user_id: string; user_name: string }>
	const _typeCheck: typeof result = [] as Array<{
		user_id: string
		user_name: string
	}>

	return result
}

async function testQualifiedTable() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table public.users (id text, name text);`)
		.database()

	// ✅ SUCCESS: qualified table name should work
	const result = await db.query(`select id, name from public.users;`)

	// Type should be: Array<{ id: string; name: string }>
	const _typeCheck: typeof result = [] as Array<{
		id: string
		name: string
	}>

	return result
}

testSelectStar()
testColumnAliases()
testQualifiedTable()
