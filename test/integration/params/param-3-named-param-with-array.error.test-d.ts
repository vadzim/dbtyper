// PARAM-3: a :name with an array of values is a compile error
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table users (id text not null, age integer);`).database()

const query = `select * from users where id = :x;` as const

// @ts-expect-error
await db.query(query, ["a"])

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1007, "Unexpected token at: :">>())
