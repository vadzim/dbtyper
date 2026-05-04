// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
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

testInsertNullIntoNotNullColumn()
