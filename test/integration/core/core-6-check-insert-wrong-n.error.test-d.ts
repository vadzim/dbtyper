// Integration Test: CORE-6 Check: passing { n: 1 } is 2509
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table users (id integer not null default 0, name text not null, email text); create table posts (id integer not null, user_id integer not null, title text);`,
	)
	.database()

// ❌ ERROR: CORE-6
const query = `insert into users (name, email) values (:n, :e)` as const

// @ts-expect-error
await db.query(query, { n: 1, e: null })

type ReturnedError = GetQueryError<typeof db, typeof query, { n: number; e: null }>

expectType<ReturnedError>(toBe<DbtyperError<2509, "Incompatible value type for parameter :n">>())
