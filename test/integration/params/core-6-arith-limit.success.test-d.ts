// CORE-6: a parameter takes the type of the column it is compared with (arithmetic, LIMIT)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null default 0, name text not null, email text, age integer);`)
	.database()

const _result = await _db.query(`select u.id from users u where :min < u.age and u.age + :d > 3 limit :n;`, {
	min: 1,
	d: 2,
	n: 10,
})

expectType<typeof _result>(toBe<Array<{ id: number }>>())
