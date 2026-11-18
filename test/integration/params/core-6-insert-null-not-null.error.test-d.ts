// CORE-6: a NOT NULL column does not take null
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null default 0, name text not null, email text, age integer);`)
	.database()

const query = `insert into users (name, email) values (:n, :e);` as const

// @ts-expect-error
await db.query(query, { n: null, e: "x" })

type ReturnedError = GetQueryError<typeof db, typeof query, { n: null; e: string }>

expectType<ReturnedError>(toBe<DbtyperError<2509, "Incompatible value type for parameter :n">>())
