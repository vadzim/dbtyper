// Integration Test: STMT-Q5 (option A) several statements in query: the rows of the last one
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver }).database()

const _result = await db.query(`select 1 as a; select 2 as b;`)

expectType<typeof _result>(toBe<{ b: number }[]>())
