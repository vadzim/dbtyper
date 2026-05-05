// Integration Test: RIGHT JOIN
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testRightJoin() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id integer not null, name text not null);`)
		.apply(`create table orders (id integer not null, user_id integer not null, total integer not null);`)
		.database()

	// ✅ SUCCESS: Basic RIGHT JOIN
	const result1 = await db.query(`select * from users right join orders on users.id = orders.user_id;`)

	// ✅ SUCCESS: RIGHT OUTER JOIN (explicit OUTER)
	const result2 = await db.query(`select * from users right outer join orders on users.id = orders.user_id;`)

	// ✅ SUCCESS: RIGHT JOIN with WHERE
	const result3 = await db.query(
		`select * from users right join orders on users.id = orders.user_id where orders.total > 100;`,
	)

	// ✅ SUCCESS: RIGHT JOIN with column selection
	const result4 = await db.query(
		`select users.name, orders.total from users right join orders on users.id = orders.user_id;`,
	)

	// ✅ SUCCESS: Multiple RIGHT JOINs
	const result5 = await db.query(
		`select * from users right join orders on users.id = orders.user_id right join users as u2 on orders.user_id = u2.id;`,
	)

	return { result1, result2, result3, result4, result5 }
}

testRightJoin()
