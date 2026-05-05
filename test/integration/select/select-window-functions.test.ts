// Integration Test: Window functions
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testWindowFunctions() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(
			`create table sales (id integer not null, product text not null, amount integer not null, sale_date text not null);`,
		)
		.database()

	// ✅ SUCCESS: ROW_NUMBER() with ORDER BY
	const result1 = await db.query(`select id, product, row_number() over (order by amount) as row_num from sales;`)

	// ✅ SUCCESS: ROW_NUMBER() with ORDER BY DESC
	const result2 = await db.query(
		`select id, product, row_number() over (order by amount desc) as row_num from sales;`,
	)

	// ✅ SUCCESS: ROW_NUMBER() with multiple ORDER BY columns
	const result3 = await db.query(
		`select id, product, row_number() over (order by product, amount desc) as row_num from sales;`,
	)

	// ✅ SUCCESS: RANK() with ORDER BY
	const result4 = await db.query(`select id, product, rank() over (order by amount) as rank_num from sales;`)

	// ✅ SUCCESS: DENSE_RANK() with ORDER BY
	const result5 = await db.query(
		`select id, product, dense_rank() over (order by amount) as dense_rank_num from sales;`,
	)

	// ✅ SUCCESS: Multiple window functions in same query
	const result6 = await db.query(
		`select id, product, row_number() over (order by amount) as row_num, rank() over (order by amount) as rank_num from sales;`,
	)

	return { result1, result2, result3, result4, result5, result6 }
}

testWindowFunctions()
