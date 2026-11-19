// Integration Test: SCHEMA-6 DDL passed to query is typed unknown
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver }).database()

const _result = await db.query(`create table q (id int);`)

expectType<typeof _result>(toBe<unknown>())
