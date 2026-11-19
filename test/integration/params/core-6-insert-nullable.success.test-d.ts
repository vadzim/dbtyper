// CORE-6: INSERT parameters take the column's type, `null` for a nullable column
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null default 0, name text not null, email text, age integer);`)
	.database()

const _result = await _db.query(`insert into users (name, email) values (:n, :e) returning name, email;`, {
	n: "a",
	e: null,
})

expectType<typeof _result>(toBe<Array<{ name: string; email: string | null }>>())
