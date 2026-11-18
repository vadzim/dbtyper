// CORE-7: `cast(:x as text)` gives the parameter its type
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`).database()

const _result = await _db.query(`select cast(:x as text) as x;`, { x: "s" })

expectType<typeof _result>(toBe<Array<{ x: string }>>())
