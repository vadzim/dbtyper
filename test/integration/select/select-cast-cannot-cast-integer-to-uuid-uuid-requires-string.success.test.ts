// Integration Test: SELECT with type casts - Cannot cast integer to uuid (uuid requires string)
// Integration Test: PostgreSQL type casts (::type)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table data (id integer not null, value text not null, num integer not null);`)
	.database()
// Note: Cannot cast integer to uuid (uuid requires string) - runtime failure

const _result = await _db.query(`select id::uuid from data;`)

type _check = Expect<
	Matches<
		typeof _result,
		{
			"?column?": string
		}[]
	>
>
