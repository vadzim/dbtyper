// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

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

testInsertTypeMismatch()
