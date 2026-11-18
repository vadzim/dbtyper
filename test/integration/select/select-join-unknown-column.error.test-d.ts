// Integration Test: SELECT - unknown column in JOIN
// ERR-8: unknown column error has no dangling " in " when the clause is not known
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer, name text);`)
	.apply(`create table posts (id integer, user_id integer);`)
	.database()

// ❌ ERROR: Unknown column in JOIN ON
const query = `select * from users join posts on users.ghost_column = posts.user_id;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<2307, "Unknown qualified column users.ghost_column">>())
