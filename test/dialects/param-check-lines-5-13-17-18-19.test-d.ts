// Integration Test: PARAM-5, PARAM-13, PARAM-17, PARAM-18, PARAM-19 Checks (verification/parameters.md @ 2a941c8)
// The runtime half of PARAM-17 ("Missing SQL parameter :nope") is in test/runtime/check-lines-param-17-stmt-17.test.ts.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import { postgresSqlDriver } from "../../src/postgres/index.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const schema = `create table users (id text not null, age integer not null, active boolean not null default true);`
type Row = { id: string; age: number; active: boolean }
const db = sqlMigrations({ driver: mockDriver }).apply(schema).database()
const pg = sqlMigrations({ driver: postgresSqlDriver({ sql: undefined as never }) })
	.apply(schema)
	.database()

// ❌ ERROR: PARAM-5 `?` under postgresSqlDriver
const p5 = `select * from users where id = ?;` as const
// @ts-expect-error
await pg.query(p5, ["a"])
expectType<GetQueryError<typeof pg, typeof p5>>(toBe<DbtyperError<1007, "Unexpected token at: ?">>())

// ❌ ERROR: PARAM-13 two `?`, one value
const p13 = `select * from users where id = ? and age > ?;` as const
// @ts-expect-error
await db.query(p13, ["a"])
expectType<GetQueryError<typeof db, typeof p13, ["a"]>>(
	toBe<DbtyperError<2404, "Positional parameter index 1 is out of bounds">>(),
)

// PARAM-17: queryUntyped takes any SQL and a named-parameter object, resolves to any[]
const _u1 = await db.queryUntyped("select * from users where id = :id", { id: "a" })
expectType<typeof _u1>(toBe<any[]>())
// the SQL is not checked: an unknown name compiles
const _u2 = db.queryUntyped("select * from users where id = :nope", { id: "a" })
_u2.catch(() => {})
// an array is not accepted (RUN-Q3)
// @ts-expect-error
db.queryUntyped("select * from users where id = ?", ["a"]).catch(() => {})

// PARAM-18: the value's type decides; no build step in between
const _ok = await db.query(`select * from users where age > :a`, { a: 1 })
expectType<typeof _ok>(toBe<Row[]>())
const p18 = `select * from users where age > :a` as const
// @ts-expect-error
await db.query(p18, { a: "x" })
expectType<GetQueryError<typeof db, typeof p18, { a: "x" }>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter :a">>(),
)

// ❌ ERROR: PARAM-19 a column problem and a missing parameter value; never any / unknown / never
const p19col = `select * from users where nope = :x` as const
// @ts-expect-error
await db.query(p19col, { x: 1 })
expectType<GetQueryError<typeof db, typeof p19col, { x: 1 }>>(
	toBe<DbtyperError<2300, "Unknown column nope in WHERE">>(), // the Check gives the code 2300 only
)
const p19par = `select * from users where age > :a` as const
// @ts-expect-error
await db.query(p19par, {})
expectType<GetQueryError<typeof db, typeof p19par, {}>>(toBe<DbtyperError<2400, "Unknown query parameter: a">>())
