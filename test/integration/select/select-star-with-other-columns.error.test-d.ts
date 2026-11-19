// Integration Test: SELECT - star with other columns
// Integration Test: SELECT syntax validation
// Tests that SELECT * must be the only projection

import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table users (id text, name text);`).database()

// ❌ ERROR: SELECT * must be only projection
const query = `select *, users.id from users;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<3400, "SELECT * must be the only projection in the list">>())
