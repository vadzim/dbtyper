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

	// ✅ SUCCESS: ROW_NUMBER() with PARTITION BY
	const result7 = await db.query(
		`select id, product, row_number() over (partition by product order by amount) as row_num from sales;`,
	)

	// ✅ SUCCESS: RANK() with PARTITION BY and multiple ORDER BY columns
	const result8 = await db.query(
		`select id, product, rank() over (partition by product order by amount desc, sale_date) as rank_num from sales;`,
	)

	// ✅ SUCCESS: Multiple PARTITION BY columns
	const result9 = await db.query(
		`select id, product, row_number() over (partition by product, sale_date order by amount) as row_num from sales;`,
	)

	// ✅ SUCCESS: PARTITION BY without ORDER BY
	const result10 = await db.query(
		`select id, product, row_number() over (partition by product) as row_num from sales;`,
	)

	// ✅ SUCCESS: LAG() with PARTITION BY and ORDER BY
	const result11 = await db.query(
		`select id, product, amount, lag(amount) over (partition by product order by sale_date) as prev_amount from sales;`,
	)

	// ✅ SUCCESS: LEAD() with PARTITION BY and ORDER BY
	const result12 = await db.query(
		`select id, product, amount, lead(amount) over (partition by product order by sale_date) as next_amount from sales;`,
	)

	// ✅ SUCCESS: LAG() with offset
	const result13 = await db.query(
		`select id, product, lag(amount, 2) over (order by sale_date) as prev_amount from sales;`,
	)

	// ✅ SUCCESS: LEAD() with offset and default value
	const result14 = await db.query(
		`select id, product, lead(amount, 1, 0) over (order by sale_date) as next_amount from sales;`,
	)

	return {
		result1,
		result2,
		result3,
		result4,
		result5,
		result6,
		result7,
		result8,
		result9,
		result10,
		result11,
		result12,
		result13,
		result14,
	}
}

testWindowFunctions()
