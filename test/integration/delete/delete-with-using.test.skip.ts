// Integration Test: DELETE
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testDeleteWithUsing() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table banned (user_id text);`)
		.database()

	// ✅ SUCCESS: DELETE with USING clause
	const result = await db.query(`delete from users using banned where users.id = banned.user_id returning users.*;`)

	return result
}

testDeleteWithUsing()
