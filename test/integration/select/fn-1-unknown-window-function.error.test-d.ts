// FN-1, PGT-33: a window call that names a function the catalog lacks is the unknown-function error
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer, name text);`)
	.database()

// ❌ ERROR: Unknown function
const query = `select ghost_window_func() over (order by id) from users;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<3619, "Unknown function: ghost_window_func">>())
