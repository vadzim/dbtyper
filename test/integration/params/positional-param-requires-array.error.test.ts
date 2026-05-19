// Integration Test: Positional parameter requires array
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { toBe, type ExpectType } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"
import type { GetQueryError } from "../../../src/core/sql-database.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, age integer);`)
	.database()

// ❌ ERROR: Using positional parameter "?" but params will be inferred as Record
const query = `select * from users where id = ?;` as const

// @ts-expect-error
await db.query(query)

const _test: ExpectType<GetQueryError<typeof db, typeof query>> = toBe<DbtyperError<1007, "Unexpected token at: ?">>()
