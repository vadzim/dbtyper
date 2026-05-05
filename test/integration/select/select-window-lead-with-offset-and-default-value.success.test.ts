// Integration Test: Window functions - LEAD() with offset and default value
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function test() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(
			`create table sales (id integer not null, product text not null, amount integer not null, sale_date text not null);`,
		)
		.database()

	// ✅ SUCCESS: LEAD() with offset and default value
	const result = await db.query(`select id, product, lead(amount, 1, 0) over (order by sale_date) as next_amount from sales;`,)

	return result
}

test()
