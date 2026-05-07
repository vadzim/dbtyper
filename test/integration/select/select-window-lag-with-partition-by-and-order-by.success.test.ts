// Integration Test: Window functions - LAG() with PARTITION BY and ORDER BY
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table sales (id integer not null, product text not null, amount integer not null, sale_date text not null);`,
	)
	.database()

// ✅ SUCCESS: LAG() with PARTITION BY and ORDER BY

const result = await db.query(
	`select id, product, amount, lag(amount) over (partition by product order by sale_date) as prev_amount from sales;`,
)

type _check = Expect<
	Matches<
		typeof result,
		{
			id: number
			amount: number
			product: string
			prev_amount: number
		}[]
	>
>
