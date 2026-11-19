// SQLT-25, SQLT-26, SQLT-27, SQLT-28, SQLT-29: main/temp, no schemas, quoting and case, result keys, blob literals.
import { sqlMigrations, type GetApplyError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const migrations = sqlMigrations({ driver: sqliteDriver })

// SQLT-25: no `create schema` before the first table; main and temp qualify tables; temp is found first
const db = migrations
	.apply(
		`create table users (id integer primary key, name text not null, email text);
		create temp table users (id integer primary key, tmp text not null);
		create temp table only_temp (x real not null);`,
	)
	.database()
const _main = await db.query(`select id, name from main.users`)
expectType<typeof _main>(toBe<Array<{ id: number; name: string }>>())
const _temp = await db.query(`select id, tmp from temp.users`)
expectType<typeof _temp>(toBe<Array<{ id: number; tmp: string }>>())
const _first = await db.query(`select tmp from users`)
expectType<typeof _first>(toBe<Array<{ tmp: string }>>())
const _only = await db.query(`select x from only_temp`)
expectType<typeof _only>(toBe<Array<{ x: number }>>())

// SQLT-26: CREATE SCHEMA, DROP SCHEMA and other qualifiers are compile errors
const createSchema = `create schema auth;` as const
// @ts-expect-error
migrations.apply(createSchema)
expectType<GetApplyError<typeof migrations, typeof createSchema>>(
	toBe<DbtyperError<1900, "CREATE SCHEMA is PostgreSQL-only; this database is SQLite. SQLite has no schemas">>(),
)
const dropSchema = `drop schema auth;` as const
// @ts-expect-error
migrations.apply(dropSchema)
expectType<GetApplyError<typeof migrations, typeof dropSchema>>(
	toBe<DbtyperError<1915, "SQLite has no schemas; drop the schema qualifier, or use main or temp">>(),
)
const otherQualifier = `create table auth.t (a int);` as const
// @ts-expect-error
migrations.apply(otherQualifier)

const users = migrations
	.apply(`create table users (id integer primary key, name text not null, email text);`)
	.database()

// SQLT-27: three quote styles, case-insensitive names
const _quoted = await users.query('select [Name], `email`, "ID" from USERS')
expectType<typeof _quoted>(toBe<Array<{ Name: string; email: string | null; ID: number }>>())

// SQLT-28: a result key is the alias, else the column name as written
const _keys = await users.query(`select Name, id as Ident, USERS.Email from users`)
expectType<typeof _keys>(toBe<Array<{ Name: string; Ident: number; Email: string | null }>>())

// SQLT-28: any other expression is keyed by its text as written; SQLite has no GROUP BY rule for bare columns
const _exprKeys = await users.query(`select Name, count(*) from users`)
expectType<typeof _exprKeys>(toBe<Array<{ Name: string; "count(*)": number }>>())
const _exprText = await users.query(`select id + 1,  upper( Name ) , id*2 as dbl, cast(id as text) from users`)
expectType<typeof _exprText>(
	toBe<Array<{ "id + 1": number; "upper( Name )": string; dbl: number; "cast(id as text)": string }>>(),
)

// SQLT-29: blob literal; adjacent string literals are not concatenated
const _blob = await users.query(`select X'0A1B' as b, 'ab' as s`)
expectType<typeof _blob>(toBe<Array<{ b: Uint8Array; s: string }>>())
// @ts-expect-error
users.query(`select 'a' 'b' as s`)
