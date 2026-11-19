// PARAM-6: `::` and `:` inside a single-quoted string are never a named parameter.
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text not null, age integer);`)
	.database()

const _result = await db.query(`select * from users where id = ':x' and age = :a::integer;`, { a: 1 })

expectType<typeof _result>(toBe<Array<{ id: string; age: number | null }>>())
