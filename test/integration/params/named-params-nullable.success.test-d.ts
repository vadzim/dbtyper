// Integration Test: PARAM-11 - an output column made from a nullable parameter value is nullable
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`).database()

// ✅ SUCCESS: PARAM-11
const _result = await _db.query(`select :x as a;`, { x: null as string | null })

expectType<typeof _result>(toBe<Array<{ a: string | null }>>())
