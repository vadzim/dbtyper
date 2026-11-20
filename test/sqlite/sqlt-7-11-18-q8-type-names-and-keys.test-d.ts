// SQLT-7, SQLT-11, SQLT-18, SQLT-Q8 B (review #175 batch 4): SQLite takes any declared type name but SERIAL by affinity,
// a STRICT column needs a type, and a table PRIMARY KEY / UNIQUE column may have COLLATE and ASC / DESC.
import { sqlMigrations, type GetApplyError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const base = sqlMigrations({ driver: sqliteDriver })
type M<S extends string> = GetApplyError<typeof base, S>

// SQLT-Q8 B: PostgreSQL names are typed by affinity (uuid, jsonb: NUMERIC), json is text, STRING / NUMBER are NUMERIC
const names = base
	.apply(`create table n (id integer primary key, j json not null, s string not null, k number not null, any_words here too);`)
	.database()
const _n = await names.query(`select j from n`)
expectType<typeof _n>(toBe<{ j: string }[]>())
await names.query(`select s, k from n`) // NUMERIC affinity (its typing is SQLT-7's)
// SQLT-17: SERIAL stays an error
// @ts-expect-error 1900 SERIAL type
base.apply(`create table s (id serial primary key);`)

// SQLT-11: a column without a type is not allowed in a STRICT table
expectType<M<`create table st (a integer, b) strict;`>>(
	toBe<DbtyperError<1910, "STRICT tables allow only INT, INTEGER, REAL, TEXT, BLOB, ANY">>(),
)
expectType<M<`create table st (a integer, b) ;`>>(toBe<null>())

// SQLT-18: ordered key columns
expectType<
	M<`create table k (id integer, name text, primary key (id desc), unique (name collate nocase asc));`>
>(toBe<null>())
