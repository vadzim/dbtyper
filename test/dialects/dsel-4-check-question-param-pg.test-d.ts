// Integration Test: DSEL-4 Check: ?1 on PostgreSQL is dbtyper:1007 "Unexpected token at: ?"
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"

const pg = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text);`)
	.database()

// ❌ ERROR: DSEL-4 ?1 on PostgreSQL
const pgQuery = "select id from users where id = ?1" as const
// @ts-expect-error
await pg.query(pgQuery, [1])
expectType<GetQueryError<typeof pg, typeof pgQuery, [number]>>(toBe<DbtyperError<1007, "Unexpected token at: ?">>())

// #196: a driver that lists question-params in its syntax does not make `?` a parameter on PostgreSQL
const pgQuery2 = "select id from users where id = ?" as const
// @ts-expect-error
await pg.query(pgQuery2, [1])
expectType<GetQueryError<typeof pg, typeof pgQuery2, [number]>>(toBe<DbtyperError<1007, "Unexpected token at: ?">>())
