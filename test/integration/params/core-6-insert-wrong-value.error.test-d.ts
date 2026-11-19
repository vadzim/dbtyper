// CORE-6: an INSERT parameter is checked against the column's type
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null default 0, name text not null, email text, age integer);`)
	.database()

const query = `insert into users (name, email) values (:n, :e);` as const

// @ts-expect-error
await db.query(query, { n: 1, e: "x" })

type ReturnedError = GetQueryError<typeof db, typeof query, { n: number; e: string }>

expectType<ReturnedError>(toBe<DbtyperError<2509, "Incompatible value type for parameter :n">>())
