// DSEL-1, SQLT-3, SQLT-4, SQLT-30: the SQLite drivers declare dialect "sqlite", bind every SQLite parameter form,
// and type their rows from SqliteTypeMap.
import { sqlMigrations } from "../../src/core/sql-database.ts"
import { betterSqlite3Driver, nodeSqliteDriver } from "../../src/sqlite/index.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

declare const betterDb: { prepare(sql: string): unknown }
declare const nodeDb: { prepare(sql: string): unknown }

const db = sqlMigrations({ driver: betterSqlite3Driver(betterDb) })
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

// DSEL-1: a SQLite driver is accepted by sqlMigrations; SQLT-3: INTEGER → number, TEXT → string
const _rows = await db.query(`select id, name from users`)
expectType<typeof _rows>(toBe<Array<{ id: number; name: string }>>())

// SQLT-4: big-integer mode types every INTEGER as bigint
const big = sqlMigrations({ driver: nodeSqliteDriver(nodeDb, { bigint: true }) })
	.apply(`create table users (id integer not null, name text not null);`)
	.database()
const _bigRows = await big.query(`select id, name from users`)
expectType<typeof _bigRows>(toBe<Array<{ id: bigint; name: string }>>())

// SQLT-30: ?, ?NNN, :name, @name and $name all lex as parameters
const _byColon = await db.query(`select name from users where id = :id`, { id: 1 })
const _byAt = await db.query(`select name from users where id = @id`, { id: 1 })
const _byDollar = await db.query(`select name from users where id = $id`, { id: 1 })
const _byQuestion = await db.query(`select name from users where id = ?`, [1])
const _byNumbered = await db.query(`select name from users where id = ?1 or id = ?1`, [1])
expectType<typeof _byColon>(toBe<Array<{ name: string }>>())
expectType<typeof _byAt>(toBe<Array<{ name: string }>>())
expectType<typeof _byDollar>(toBe<Array<{ name: string }>>())
expectType<typeof _byQuestion>(toBe<Array<{ name: string }>>())
expectType<typeof _byNumbered>(toBe<Array<{ name: string }>>())
