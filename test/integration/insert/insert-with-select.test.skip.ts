// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
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

testInsertWithSelect()
