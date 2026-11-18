// CORE-7: `cast(? as integer)` gives a positional parameter its type
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`).database()

const _result = await _db.query(`select ?::text as a, cast(? as integer) as b;`, ["s", 1])

expectType<typeof _result>(toBe<Array<{ a: string; b: number }>>())
