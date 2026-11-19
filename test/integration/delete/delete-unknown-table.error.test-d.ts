// Integration Test: DELETE - unknown table (DML-12)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table users (id integer, name text);`).database()

// ❌ ERROR: Unknown table in DELETE FROM
const query = `delete from ghost_table;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<2200, "Unknown table ghost_table in DELETE FROM">>())
