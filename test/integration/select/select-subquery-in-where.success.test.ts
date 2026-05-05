// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testSelectSubqueryInWhere() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text);`)
		.database()

	// ✅ SUCCESS: subquery in WHERE with IN
	const result = await db.query(`select * from users where id in (select user_id from posts);`)

	return result
}

testSelectSubqueryInWhere()
