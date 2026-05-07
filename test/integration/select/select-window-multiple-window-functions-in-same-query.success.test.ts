// Integration Test: Window functions - Multiple window functions in same query
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table sales (id integer not null, product text not null, amount integer not null, sale_date text not null);`,
	)
	.database()

// ✅ SUCCESS: Multiple window functions in same query

const _result = await db.query(
	`select id, product, row_number() over (order by amount) as row_num, rank() over (order by amount) as rank_num from sales;`,
)

type _check = Expect<
	Matches<
		typeof result,
		{
			id: number
			product: string
			row_num: bigint
			rank_num: bigint
		}[]
	>
>
