// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testSelectJoinTypeMismatch() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id integer, user_id text, title text);`)
		.database()

	// ❌ ERROR: JOIN condition type mismatch (text vs integer)
	const bad = await db.query(
		// @ts-expect-error
		`select * from users inner join posts on users.id = posts.id;`,
	)

	return bad
}

testSelectJoinTypeMismatch()
