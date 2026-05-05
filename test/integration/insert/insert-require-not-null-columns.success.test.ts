// Integration Test: INSERT - require values for NOT NULL columns without defaults
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testInsertRequireNotNullColumns() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text not null, name text not null, email text);`)
		.database()

	// ✅ SUCCESS: all NOT NULL columns provided
	const result1 = await db.query(`insert into users (id, name) values ('1', 'Alice') returning *;`)

	// ✅ SUCCESS: nullable column can be omitted
	const result2 = await db.query(`insert into users (id, name, email) values ('2', 'Bob', null) returning *;`)

	// ❌ ERROR: missing NOT NULL column 'name'
	const bad = await db.query(
		// @ts-expect-error
		`insert into users (id) values ('3') returning *;`,
	)

	return { result1, result2, bad }
}

testInsertRequireNotNullColumns()
