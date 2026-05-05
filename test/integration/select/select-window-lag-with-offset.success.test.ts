// Integration Test: Window functions - LAG() with offset
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Extends, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table sales (id integer not null, product text not null, amount integer not null, sale_date text not null);`,
	)
	.database()

// ✅ SUCCESS: LAG() with offset
const result = await db.query(`select id, product, lag(amount, 2) over (order by sale_date) as prev_amount from sales;`)
type _check = Expect<Matches<typeof result, { id: number; product: string; prev_amount: number }[]>>
