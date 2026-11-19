// Integration Test: STMT-8 — empty statements (`;;`) are ignored
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table t (a integer not null);`).database()

// ✅ SUCCESS: STMT-8 a trailing empty statement does not change the result type
const _result = await db.query("select a from t; ;")
expectType<typeof _result>(toBe<{ a: number }[]>())
