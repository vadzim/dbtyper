// Integration Test: SEL-Q4 NULLS FIRST is not parsed (SPEC-Q SEL-Q4, current generic behaviour)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

// Current generic behaviour, not a deliberate message: see SPEC-Q SEL-Q4.
// ❌ ERROR: NULLS FIRST is not parsed (SPEC-Q SEL-Q4, current generic behaviour)
const query = `select id from users order by id nulls first;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1105, "Expected semicolon after SELECT">>())
