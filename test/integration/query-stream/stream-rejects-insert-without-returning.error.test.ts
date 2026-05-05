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

	// ❌ INSERT without RETURNING should be rejected by stream()
	// @ts-expect-error
	const stream = db.stream(`insert into users (id, name) values ('1', 'Alice');`)

	return stream
}

test()
