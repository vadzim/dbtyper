// Integration Test: INSERT - unknown schema or table
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table users (id integer, name text);`).database()

// ❌ ERROR: Unknown schema or table in INSERT INTO
const query = `insert into ghost_schema.users (id, name) values (1, 'test');` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<2207, "Unknown schema or table ghost_schema in INSERT INTO">>())
