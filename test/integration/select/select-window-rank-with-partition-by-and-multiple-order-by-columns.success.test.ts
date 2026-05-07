// Integration Test: Window functions - RANK() with PARTITION BY and multiple ORDER BY columns
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table sales (id integer not null, product text not null, amount integer not null, sale_date text not null);`,
	)
	.database()

// ✅ SUCCESS: RANK() with PARTITION BY and multiple ORDER BY columns

const result = await db.query(
	`select id, product, rank() over (partition by product order by amount desc, sale_date) as rank_num from sales;`,
)

type _check = Expect<
	Matches<
		typeof result,
		{
			id: number
			product: string
			rank_num: bigint
		}[]
	>
>
