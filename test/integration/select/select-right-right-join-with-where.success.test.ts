// Integration Test: SELECT with RIGHT JOIN - RIGHT JOIN with WHERE
// Integration Test: RIGHT JOIN
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function test() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id integer not null, name text not null);`)
		.apply(`create table orders (id integer not null, user_id integer not null, total integer not null);`)
		.database()

	// ✅ SUCCESS: RIGHT JOIN with WHERE
	const result = await db.query(
		`select * from users right join orders on users.id = orders.user_id where orders.total > 100;`,
	)

	return result
}

test()
