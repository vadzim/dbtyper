// Integration Test: SELECT with type casts - Cast number literal to text (like existing test)
// Integration Test: PostgreSQL type casts (::type)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table data (id integer not null, value text not null, num integer not null);`)
	.database()
// ✅ SUCCESS: Cast number literal to text (like existing test)

const result = await db.query(`select 42::text as num_text from data;`)

type _check = Expect<
	Matches<
		typeof result,
		Array<{
			num_text: string
		}>
	>
>
