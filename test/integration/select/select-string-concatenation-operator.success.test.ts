// Integration Test: SELECT with || (string concatenation) operator
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, first_name text not null, last_name text not null);`)
	.database()

// ✅ SUCCESS: || (string concatenation) operator

const _result = await db.query(`select first_name || ' ' || last_name as full_name from users;`)

type _check = Expect<
	Matches<
		typeof _result,
		Array<{
			full_name: string
		}>
	>
>
