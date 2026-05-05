// Integration Test: Window functions - PARTITION BY without ORDER BY
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
// ✅ SUCCESS: PARTITION BY without ORDER BY
const result = await db.query(`select id, product, row_number() over (partition by product) as row_num from sales;`)
type _check = Expect<Extends<typeof result, unknown[]>>
