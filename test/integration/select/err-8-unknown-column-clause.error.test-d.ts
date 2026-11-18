// Integration Test: ERR-8 an unknown column names the clause it appears in
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

// ❌ ERROR: ERR-8 select list
const selectList = `select ghost_column + 10 as result from users;` as const
// @ts-expect-error
await db.query(selectList)
expectType<GetQueryError<typeof db, typeof selectList>>(
	toBe<DbtyperError<2300, "Unknown column ghost_column in SELECT list">>(),
)

// ❌ ERROR: ERR-8 where
const where = `select id from users where ghost_column = 1;` as const
// @ts-expect-error
await db.query(where)
expectType<GetQueryError<typeof db, typeof where>>(toBe<DbtyperError<2300, "Unknown column ghost_column in WHERE">>())

// ❌ ERROR: ERR-8 order by
const orderBy = `select id from users order by ghost_column;` as const
// @ts-expect-error
await db.query(orderBy)
expectType<GetQueryError<typeof db, typeof orderBy>>(
	toBe<DbtyperError<2300, "Unknown column ghost_column in ORDER BY">>(),
)
