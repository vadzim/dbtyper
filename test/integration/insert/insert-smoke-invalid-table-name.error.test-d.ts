// Integration Test: INSERT smoke tests - Invalid table name
// Integration Test: INSERT statements
// Minimal tests demonstrating API functionality

import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id text, name text, email text);`)
	.database()

// ❌ ERROR: Invalid table name
const query = `insert into invalid_table (id) values (null);` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<2200, "Unknown table invalid_table in INSERT INTO">>())
