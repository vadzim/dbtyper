// Integration Test: Window functions - LEAD() with PARTITION BY and ORDER BY
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table sales (id integer not null, product text not null, amount integer not null, sale_date text not null);`,
	)
	.database()

// ✅ SUCCESS: LEAD() with PARTITION BY and ORDER BY

const _result = await _db.query(
	`select id, product, amount, lead(amount) over (partition by product order by sale_date) as next_amount from sales;`,
)

type _check = Expect<
	Matches<
		typeof _result,
		{
			id: number
			amount: number
			product: string
			next_amount: number
		}[]
	>
>
