// PARAM-14: array elements that the SQL does not use are accepted.
// BUG: PARAM-14 the library reports dbtyper:2405 for the unused key/element; the spec says it is accepted.
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table users (id text not null, age integer);`).database()

const _result = await db.query(`select * from users where id = ?;`, ["a", 1])

expectType<typeof _result>(toBe<Array<{ id: string; age: number | null }>>())
