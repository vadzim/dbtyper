// Integration Test: STMT-Q5 (option A) several statements in query: unknown if the last returns no rows
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table t (id int not null);`).database()

const _result = await db.query(`select 1 as a; create table q (id int);`)

expectType<typeof _result>(toBe<unknown>())
