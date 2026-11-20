// #169 (SQLT-4, SQLT-7): a NUMERIC column is `number | string`, plus `bigint` in big-integer mode; #156 (STMT-Q5): node:sqlite runs only
// the first statement of a text, so a second statement in query / stream is error 1932 (migrations may have several).
import { sqlMigrations, type GetQueryError, type GetStreamError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { nodeSqliteDriver } from "../../src/sqlite/index.ts"
import { sqliteBigintDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const schema = `create table t (id integer primary key, n numeric, m numeric not null);`

const bigDb = sqlMigrations({ driver: sqliteBigintDriver }).apply(schema).database()
const _big = await bigDb.query(`select n, m, n + 1 as n1 from t`)
expectType<typeof _big>(
	toBe<
		Array<{ n: number | string | bigint | null; m: number | string | bigint; n1: number | string | bigint | null }>
	>(),
)

const db = sqlMigrations({ driver: sqliteDriver }).apply(schema).database()
const _small = await db.query(`select n, m from t`)
expectType<typeof _small>(toBe<Array<{ n: number | string | null; m: number | string }>>())

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

// SQLT-7: a NUMERIC-affinity column takes text and numbers on write (no 2507/2508/2510); Signal's schema: `x STRING DEFAULT ''`
const _signal = sqlMigrations({ driver: sqliteDriver })
	.apply(
		`create table message (id integer primary key, body string default '', n numeric not null default 'x', d date, j json);
		create table archive (body string, n numeric, d date);
		insert into message (body, n) values ('hi', 5), (7, 'text');
		insert into archive (body, n, d) select body, n, d from message;
		update message set body = 5, n = 'y' where id = 1;`,
	)
	.database()
const _signalRows = await _signal.query(`select body, n from archive`)
expectType<typeof _signalRows>(toBe<Array<{ body: number | string | null; n: number | string | null }>>())
const _dateText = `insert into message (d) values (5)` as const
expectType<GetQueryError<typeof _signal, typeof _dateText>>(toBe<DbtyperError<2510, "column `d` is TEXT">>())
