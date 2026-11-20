// Integration Test: STMT-7 a decimal number literal is a number: PostgreSQL `numeric`, a string (PGT-3, PGT-35, #153)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver }).database()

const _result = await db.query(`select 1.5 as x;`)

expectType<typeof _result>(toBe<{ x: string }[]>())
