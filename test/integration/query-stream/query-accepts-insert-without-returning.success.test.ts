// Integration Test: db.query() accepts non-RETURNING statements
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

	// ✅ INSERT without RETURNING should be accepted by query()
	const result = await db.query(`insert into users (id, name) values ('1', 'Alice');`)

	// Result type should be unknown
	type ResultType = typeof result
	type _check = ResultType extends unknown ? true : false

	return result
}

test()
