// PARAM-14: object keys that the SQL does not use are accepted.
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table users (id text not null, age integer);`).database()

const _result = await db.query(`select * from users where id = :x;`, { x: "a", extra: 1 })

expectType<typeof _result>(toBe<Array<{ id: string; age: number | null }>>())
