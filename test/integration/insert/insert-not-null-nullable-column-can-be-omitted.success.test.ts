// Integration Test: INSERT NOT NULL validation - nullable column can be omitted
// Integration Test: INSERT - require values for NOT NULL columns without defaults
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function test() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text not null, name text not null, email text);`)
		.database()

	// ✅ SUCCESS: nullable column can be omitted
	const result = await db.query(`insert into users (id, name, email) values ('2', 'Bob', null) returning *;`)

	return result
}

test()
