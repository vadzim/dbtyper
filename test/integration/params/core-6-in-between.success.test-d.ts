// CORE-6: a parameter takes the type of the column it is compared with (IN, BETWEEN)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null default 0, name text not null, email text, age integer);`)
	.database()

const _result = await _db.query(`select id from users where name in (:a, :b) and age between :lo and :hi;`, {
	a: "x",
	b: "y",
	lo: 1,
	hi: 2,
})

expectType<typeof _result>(toBe<Array<{ id: number }>>())
