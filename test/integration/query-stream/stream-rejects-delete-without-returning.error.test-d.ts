// Integration Test: _db․stream() rejects non-RETURNING statements
import { sqlMigrations, type GetStreamError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table users (id text, name text);`).database()

// ❌ DELETE without RETURNING should be rejected by stream()
const query = `delete from users where id = '1';` as const

// @ts-expect-error
await db.stream(query)

type ReturnedError = GetStreamError<typeof db, typeof query>

expectType<ReturnedError>(
	toBe<DbtyperError<3501, "stream() requires a row-returning statement (SELECT or RETURNING clause)">>(),
)
