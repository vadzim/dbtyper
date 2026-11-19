// Integration Test: FN-4 COUNT(*) is a string (bigint), function names are case-insensitive
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table t (id int not null);`).database()

const _result = await db.query(`select COUNT(*) as n from t`)

expectType<typeof _result>(toBe<{ n: string }[]>())
