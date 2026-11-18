// CORE-6: UPDATE SET parameters take the column's type, `null` for a nullable column
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null default 0, name text not null, email text, age integer);`)
	.database()

const _result = await _db.query(`update users set email = :e where name = :n returning email;`, { e: null, n: "a" })

expectType<typeof _result>(toBe<Array<{ email: string | null }>>())
