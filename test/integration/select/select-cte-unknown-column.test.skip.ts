// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testSelectCTEUnknownColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: reference unknown column from CTE
	// Feature not implemented: Parser does not validate CTE column names
	const bad = await db.query(
		`with active_users as (select id, name from users) 
     select invalid_column from active_users;`,
	)

	return bad
}

testSelectCTEUnknownColumn()
