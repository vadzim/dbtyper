// Integration Test: SELECT
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id text not null, name text not null);`)
	.database()

// ❌ ERROR: Correlated subquery referencing outer table in inner select list
const query = `select u.id from users as u join (select u.id from users) t on u.id = t.id;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<2307, "Unknown qualified column u.id">>())
