// CORE-6: a comparison parameter is not nullable, only INSERT/UPDATE parameters of a nullable column are
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null default 0, name text not null, email text, age integer);`)
	.database()

const query = `update users set email = :e where name = :n;` as const

// @ts-expect-error
await db.query(query, { e: null, n: null })

type ReturnedError = GetQueryError<typeof db, typeof query, { e: null; n: null }>

expectType<ReturnedError>(toBe<DbtyperError<2509, "Incompatible value type for parameter :n">>())
