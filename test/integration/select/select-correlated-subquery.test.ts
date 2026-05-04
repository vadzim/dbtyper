// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testSelectCorrelatedSubquery() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text, created_at text);`)
		.database()

	// ✅ SUCCESS: correlated subquery
	const result = await db.query(
		`select * from posts p1 where exists (select 1 from posts p2 where p2.user_id = p1.user_id);`,
	)

	return result
}

testSelectCorrelatedSubquery()
