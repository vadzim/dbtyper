// Integration Test: PARAM-11 - a non-null parameter value stays non-null
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`).database()

// ✅ SUCCESS: PARAM-11 (non-null parameter stays non-null)
const _result = await _db.query(`select :x as a;`, { x: "s" })

expectType<typeof _result>(toBe<Array<{ a: string }>>())
