// Integration Test: Expected comma, WHERE, or end after ON CONFLICT SET (5408)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id text not null);`)
	.database()

// ❌ ERROR: Expected comma, WHERE, or end after ON CONFLICT SET
const query = `insert into items (id) values ('1') on conflict (id) do update set id = '2' invalid;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<5408, "Expected `,`, WHERE, or end after ON CONFLICT SET">>())
