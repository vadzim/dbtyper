// Integration Test: SELECT - ORDER missing BY keyword
// Integration Test: SELECT syntax validation
// Tests that ORDER clause requires BY keyword

import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table users (id text, name text);`).database()

// ❌ ERROR: missing BY keyword after ORDER
const query = `select users.name from users order users.name;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1108, "Expected BY after ORDER">>())
