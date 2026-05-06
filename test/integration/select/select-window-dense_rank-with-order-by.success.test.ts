// Integration Test: Window functions - DENSE_RANK() with ORDER BY
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
// ✅ SUCCESS: DENSE_RANK() with ORDER BY

const result = await db.query(`select id, product, dense_rank() over (order by amount) as dense_rank_num from sales;`)

type _check = Expect<
	Matches<
		typeof result,
		{
			id: number
			product: string
			dense_rank_num: bigint
		}[]
	>
>
