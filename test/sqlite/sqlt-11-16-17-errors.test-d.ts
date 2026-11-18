// SQLT-11, SQLT-16, SQLT-17: STRICT type names, AUTOINCREMENT and SERIAL are compile errors.
import { sqlMigrations, type GetApplyError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const migrations = sqlMigrations({ driver: sqliteDriver })

// SQLT-11
const strictQuery = `create table s (a varchar(5)) strict;` as const
// @ts-expect-error
migrations.apply(strictQuery)
expectType<GetApplyError<typeof migrations, typeof strictQuery>>(
	toBe<DbtyperError<1910, "STRICT tables allow only INT, INTEGER, REAL, TEXT, BLOB, ANY">>(),
)

// SQLT-11: the allowed names work, ANY is typed like an untyped column
const strictOk = migrations
	.apply(`create table s (a int not null, b real not null, c text not null, d blob not null, e any not null) strict;`)
	.database()
const _strictOk = await strictOk.query(`select a, b, c, d, e from s`)
expectType<typeof _strictOk>(
	toBe<Array<{ a: number; b: number; c: string; d: Uint8Array; e: number | string | Uint8Array }>>(),
)

// SQLT-16
const autoQuery = `create table a (id int primary key autoincrement);` as const
// @ts-expect-error
migrations.apply(autoQuery)
expectType<GetApplyError<typeof migrations, typeof autoQuery>>(
	toBe<DbtyperError<1911, "AUTOINCREMENT is allowed only on a column declared INTEGER PRIMARY KEY">>(),
)
const autoOk = migrations.apply(`create table a (id integer primary key autoincrement, n text);`).database()
const _autoOk = await autoOk.query(`insert into a (n) values ('x') returning id`)
expectType<typeof _autoOk>(toBe<Array<{ id: number }>>())

// SQLT-17
const serialQuery = `create table b (id serial primary key);` as const
// @ts-expect-error
migrations.apply(serialQuery)
expectType<GetApplyError<typeof migrations, typeof serialQuery>>(
	toBe<DbtyperError<1900, "SERIAL type is PostgreSQL-only; this database is SQLite. Use INTEGER PRIMARY KEY">>(),
)
