// SQLT-44, SQLT-45, SQLT-46 with parameters (CORE-6): a parameter takes its type from the function's argument table.
import { sqlMigrations } from "../../src/core/sql-database.ts"
import { sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table t (id integer primary key, name text not null, nick text);`)
	.database()

const _instr = await db.query(`select id from t where instr(name, :needle) > 0`, { needle: "a" })
expectType<typeof _instr>(toBe<Array<{ id: number }>>())
const _ifnull = await db.query(`select ifnull(nick, :fallback) as n from t`, { fallback: "x" })
expectType<typeof _ifnull>(toBe<Array<{ n: string }>>())
const _max = await db.query(`select max(id, :other) as m from t`, { other: 3 })
expectType<typeof _max>(toBe<Array<{ m: number }>>())
