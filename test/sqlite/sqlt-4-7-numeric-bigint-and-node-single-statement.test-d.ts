// #169 (SQLT-4, SQLT-7): a NUMERIC column in big-integer mode is `number | bigint`; #156 (STMT-Q5): node:sqlite runs only
// the first statement of a text, so a second statement in query / stream is error 1932 (migrations may have several).
import { sqlMigrations, type GetQueryError, type GetStreamError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { nodeSqliteDriver } from "../../src/sqlite/index.ts"
import { sqliteBigintDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const schema = `create table t (id integer primary key, n numeric, m numeric not null);`

const bigDb = sqlMigrations({ driver: sqliteBigintDriver }).apply(schema).database()
const _big = await bigDb.query(`select n, m, n + 1 as n1 from t`)
expectType<typeof _big>(toBe<Array<{ n: number | bigint | null; m: number | bigint; n1: number | bigint | null }>>())

const db = sqlMigrations({ driver: sqliteDriver }).apply(schema).database()
const _small = await db.query(`select n, m from t`)
expectType<typeof _small>(toBe<Array<{ n: number | null; m: number }>>())

declare const nodeHandle: { prepare(sql: string): unknown }
const _node = sqlMigrations({ driver: nodeSqliteDriver(nodeHandle) })
	.apply(`create table t (id integer primary key); create table u (id integer primary key);`) // migrations: several statements
	.database()
const _one = `select id from t` as const
const _two = `select id from t; select id from t` as const
const _trailing = `select id from t;;` as const
const _msg = "This driver runs only the first statement of a text; send one statement per query or stream call" as const
expectType<GetQueryError<typeof _node, typeof _one>>(toBe<null>())
expectType<GetQueryError<typeof _node, typeof _trailing>>(toBe<null>())
expectType<GetQueryError<typeof _node, typeof _two>>(toBe<DbtyperError<1932, typeof _msg>>())
expectType<GetStreamError<typeof _node, typeof _two>>(toBe<DbtyperError<1932, typeof _msg>>())

// better-sqlite3 throws at run time for several statements: the same compile error (STMT-22)
const _better = sqlMigrations({ driver: sqliteDriver }).apply(schema).database()
expectType<GetQueryError<typeof _better, typeof _two>>(toBe<DbtyperError<1932, typeof _msg>>())
void db
