// CORE-6, SQLT-33: a parameter operand of IS [NOT] DISTINCT FROM (both dialects) or SQLite's IS / IS NOT also accepts null
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import { mockDriver, sqliteMockDriver } from "../test-utils/test-databases.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"

const ddl = `create table users (id integer not null, name text not null, email text);`
const lite = sqlMigrations({ driver: sqliteMockDriver }).apply(ddl).database()
const pg = sqlMigrations({ driver: mockDriver }).apply(ddl).database()

const _a = await lite.query(`select id from users where email is :e and name is not :n`, { e: null, n: null })
expectType<typeof _a>(toBe<Array<{ id: number }>>())
const isQuery = `select id from users where email is :e and name is not :n` as const
// @ts-expect-error
await lite.query(isQuery, { e: 1, n: null })
expectType<GetQueryError<typeof lite, typeof isQuery, { e: number; n: null }>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter :e">>(),
)

const dq = `select id from users where email is not distinct from :e or name is distinct from :n` as const
const _b = await lite.query(dq, { e: null, n: null })
expectType<typeof _b>(toBe<Array<{ id: number }>>())
const _c = await pg.query(dq, { e: null, n: null })
expectType<typeof _c>(toBe<Array<{ id: number }>>())

// a plain comparison stays non-null
const eq = `select id from users where name = :n` as const
// @ts-expect-error
await lite.query(eq, { n: null })
// @ts-expect-error
await pg.query(eq, { n: null })
