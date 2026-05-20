// Integration Test: SELECT - unnest with non-array argument
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id integer, priority integer);`)
	.database()

// ❌ ERROR: unnest requires array type, but id is integer
const query = `select unnest(id) as bad from items;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<3616, "unnest expects an array">>())
