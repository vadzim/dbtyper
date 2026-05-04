// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testSelectSimpleCTE() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: simple CTE
	const result = await db.query(
		`with active_users as (select * from users where id is not null) 
     select * from active_users;`,
	)

	return result
}

testSelectSimpleCTE()
