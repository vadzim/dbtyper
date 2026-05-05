// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testSelectInvalidGroupBy() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table posts (id text, user_id text, title text);`)
		.database()

	// ❌ ERROR: SELECT non-grouped column without aggregate
	const bad = await db.query(
		// @ts-expect-error
		`select user_id, title, count(*) from posts group by user_id;`,
	)

	return bad
}

testSelectInvalidGroupBy()
