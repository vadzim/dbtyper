// CORE-7: `:x::integer` gives the parameter its type
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver }).database()

const _result = await _db.query(`select :x::integer as x;`, { x: 5 })

expectType<typeof _result>(toBe<Array<{ x: number }>>())
