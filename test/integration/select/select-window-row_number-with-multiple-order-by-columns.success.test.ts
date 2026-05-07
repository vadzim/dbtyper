// Integration Test: Window functions - ROW_NUMBER() with multiple ORDER BY columns
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table sales (id integer not null, product text not null, amount integer not null, sale_date text not null);`,
	)
	.database()
// ✅ SUCCESS: ROW_NUMBER() with multiple ORDER BY columns

const _result = await _db.query(
	`select id, product, row_number() over (order by product, amount desc) as row_num from sales;`,
)

type _check = Expect<
	Matches<
		typeof _result,
		{
			id: number
			product: string
			row_num: bigint
		}[]
	>
>
