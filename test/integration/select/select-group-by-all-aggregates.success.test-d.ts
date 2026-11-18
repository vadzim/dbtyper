// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
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

expectType<typeof _result>(
	toBe<
		{
			region: string | null
			total_count: string
			amount_count: string
			total_amount: string | null
			avg_amount: string | null
			min_amount: string | null
			max_amount: string | null
			min_qty: number | null
			max_qty: number | null
		}[]
	>(),
)
