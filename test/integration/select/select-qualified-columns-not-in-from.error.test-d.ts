// Integration Test: SELECT - qualified columns not in FROM
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id text, name text);`)
	.apply(`create table other_table (value text);`)
	.database()

// Even though users table exists in database, we cannot reference users.id
// because users is not in the FROM clause (only other_table is)
const query = `select users.id, users.name from other_table;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<2307, "Unknown qualified column users.id">>())
