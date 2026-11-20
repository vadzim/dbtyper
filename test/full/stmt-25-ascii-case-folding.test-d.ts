// STMT-25: an unquoted name may hold non-ASCII letters; both engines fold only A-Z to lower case, so a non-ASCII
// capital stays as written (TypeScript's `Lowercase` would fold it too). #179 item 5d.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

type IsError<E> = E extends DbtyperError<number, string> ? true : false

// PostgreSQL: `Імя` and `NAMEІ` keep their Cyrillic capitals; the ASCII letters fold
const pg = sqlMigrations({ driver: mockDriver })
	.apply(`create table Тэст (Імя text not null, NAMEІ integer not null);`)
	.database()
const _pg = await pg.query(`select Імя, nameІ, NameІ as n from Тэст`)
expectType<typeof _pg>(toBe<Array<{ Імя: string; nameІ: number; n: number }>>())
const _pgQuoted = await pg.query(`select "Імя" from "Тэст"`)
expectType<typeof _pgQuoted>(toBe<Array<{ Імя: string }>>())
expectType<IsError<GetQueryError<typeof pg, `select імя from Тэст`>>>(toBe<true>())
expectType<IsError<GetQueryError<typeof pg, `select Імя from тэст`>>>(toBe<true>())
expectType<IsError<GetQueryError<typeof pg, `select namei from Тэст`>>>(toBe<true>())

// SQLite: names match case-insensitively in ASCII only, quoted or not
const lite = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table Тэст (Імя text not null, "NAMEІ" integer not null);`)
	.database()
const _lite = await lite.query(`select Імя, nameІ from Тэст`)
expectType<typeof _lite>(toBe<Array<{ Імя: string; NAMEІ: number }>>())
expectType<IsError<GetQueryError<typeof lite, `select імя from Тэст`>>>(toBe<true>())
expectType<IsError<GetQueryError<typeof lite, `select "імя" from Тэст`>>>(toBe<true>())

// CREATE TABLE … AS in SQLite folds the output names the same way
const liteAs = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table s (Імя text not null); create table c as select Імя from s;`)
	.database()
const _liteAs = await liteAs.query(`select Імя from c`)
expectType<typeof _liteAs>(toBe<Array<{ Імя: string | null }>>())
expectType<IsError<GetQueryError<typeof liteAs, `select імя from c`>>>(toBe<true>())
