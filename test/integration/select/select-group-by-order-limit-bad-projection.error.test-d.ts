// Integration Test: SELECT
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table sales (region text, amount integer);`).database()

// ❌ ERROR: Grouped SELECT requires column to appear in GROUP BY or inside an aggregate
const query = `select region, amount from sales group by region order by region limit 1;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(
	toBe<DbtyperError<3403, "Grouped SELECT requires column to appear in GROUP BY or inside an aggregate">>(),
)
