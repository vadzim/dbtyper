// Integration Test: DSEL-1, DSEL-11 - a SQLite driver makes a SQLite chain that types shared SQL as usual
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { sqliteMockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: sqliteMockDriver })
	.apply(`create table users (id integer not null, name text);`)
	.database()

// ✅ SUCCESS: DSEL-1 the dialect follows the driver; DSEL-11 shared SQL keeps its meaning
const _result = await _db.query(`select id, cast(id as text) as t, name from users where name = :n`, { n: "a" })

expectType<typeof _result>(toBe<Array<{ id: number; t: string; name: string | null }>>())
