// Integration Test: SELECT with type casts - Cast in WHERE clause
// Integration Test: PostgreSQL type casts (::type)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table data (id integer not null, value text not null, num integer not null);`)
	.database()
// ✅ SUCCESS: Cast in WHERE clause

const result = await db.query(`select * from data where id::text = '123';`)

type _check = Expect<
	Matches<
		typeof result,
		Array<{
			id: number
			value: string
			num: number
		}>
	>
>
