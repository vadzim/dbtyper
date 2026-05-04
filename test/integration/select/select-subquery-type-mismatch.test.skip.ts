// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testSelectSubqueryTypeMismatch() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id integer);`)
		.database()

	// ❌ ERROR: subquery type mismatch
	const bad = await db.query(
		// @ts-expect-error
		`select * from users where id in (select user_id from posts);`,
	)

	return bad
}

testSelectSubqueryTypeMismatch()
