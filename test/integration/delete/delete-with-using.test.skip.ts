// Integration Test: DELETE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testDeleteWithUsing() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table banned (user_id text);`)
		.database()

	// Feature not implemented: DELETE...USING clause (PostgreSQL extension)
	// Requires parser support for USING clause in DELETE statements
	const result = await db.query(`delete from users using banned where users.id = banned.user_id returning users.*;`)

	return result
}

testDeleteWithUsing()
