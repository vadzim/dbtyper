// Integration Test: DSEL-4 Check: ?1 on PostgreSQL is dbtyper:1007 "Unexpected token at: ?"
// SKIPPED (bug #196): the code gives DbtyperError<1105, "Expected semicolon after SELECT">, the Check says 1007.
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
