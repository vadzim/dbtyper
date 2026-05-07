// Integration Test: CREATE TABLE with PostgreSQL-specific types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: bytea (binary data)

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table files (id integer not null, data bytea not null);`)
	.database()

const _result = await db.query(`select id, data from files;`)

type _check = Expect<
	Matches<
		typeof result,
		{
			id: number
			data: unknown
		}[]
	>
>
