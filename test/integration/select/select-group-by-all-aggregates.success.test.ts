// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table sales (region text, amount numeric, quantity integer);`)
	.database()
// ✅ SUCCESS: GROUP BY with all aggregate functions

const _result = await _db.query(`
	select 
		region,
		count(*) as total_count,
		count(amount) as amount_count,
		sum(amount) as total_amount,
		avg(amount) as avg_amount,
		min(amount) as min_amount,
		max(amount) as max_amount,
		min(quantity) as min_qty,
		max(quantity) as max_qty
	from sales 
	group by region;
`)

type _check = Expect<
	Matches<
		typeof _result,
		{
			region: string
			total_count: bigint
			amount_count: bigint
			total_amount: string
			avg_amount: string
			min_amount: string
			max_amount: string
			min_qty: number
			max_qty: number
		}[]
	>
>
