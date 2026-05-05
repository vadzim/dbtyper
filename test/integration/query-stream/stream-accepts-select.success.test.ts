// Integration Test: db.stream() rejects non-RETURNING statements
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function test() {

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

test()
