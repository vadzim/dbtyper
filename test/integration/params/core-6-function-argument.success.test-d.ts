// CORE-6: a parameter used as a function argument takes the argument's SQL type
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null, nick text, age integer);`)
	.database()

const _result = await _db.query(`select id from users where name = lower(:x);`, { x: "A" })

expectType<typeof _result>(toBe<Array<{ id: number }>>())
