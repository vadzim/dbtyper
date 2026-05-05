// Integration Test: Window functions - ROW_NUMBER() with ORDER BY DESC
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

	// ✅ SUCCESS: ROW_NUMBER() with ORDER BY DESC
	const result = await db.query(`select id, product, row_number() over (order by amount desc) as row_num from sales;`)

	return result
}

test()
