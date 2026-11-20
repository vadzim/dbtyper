// Integration Test: UPDATE a table named by a non-reserved keyword (#165)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table type (key integer not null);`).database()

// ✅ SUCCESS
const _result = await db.query(`update type set key = 2 returning key;`)

expectType<typeof _result>(toBe<Array<{ key: number }>>())
