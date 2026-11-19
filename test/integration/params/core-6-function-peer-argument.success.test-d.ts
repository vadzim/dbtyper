// CORE-6: a parameter in coalesce(...) takes the type of the other arguments
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null, nick text, age integer);`)
	.database()

const _result = await _db.query(`select id from users where coalesce(nick, :n) = :m;`, { n: "a", m: "b" })
expectType<typeof _result>(toBe<Array<{ id: number }>>())
