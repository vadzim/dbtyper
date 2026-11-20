// DSEL-4 Check: select 1 as x is { x: number } in both; ?1 is accepted by SQLite (the PostgreSQL 1007 half: dsel-4-check-question-param-pg.test-d.ts)
import { sqlMigrations } from "../../src/core/sql-database.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const lite = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table users (id integer not null, name text);`)
	.database()
const pg = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text);`)
	.database()

// ✅ SUCCESS: DSEL-4
const _liteX = await lite.query("select 1 as x")
const _pgX = await pg.query("select 1 as x")
expectType<typeof _liteX>(toBe<Array<{ x: number }>>())
expectType<typeof _pgX>(toBe<Array<{ x: number }>>())

// ✅ SUCCESS: DSEL-4 ?1 on SQLite
const _liteRows = await lite.query("select id from users where id = ?1", [1])
expectType<typeof _liteRows>(toBe<Array<{ id: number }>>())
