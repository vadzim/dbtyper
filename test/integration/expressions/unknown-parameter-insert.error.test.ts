// Integration Test: Expressions
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text not null, name text not null);`)
	.database()

// ❌ ERROR: Unknown query parameters in INSERT (no params provided)
const query = `insert into users (id, name) values (:id, :name);` as const

// @ts-expect-error
await db.query(query, { id: "id" })

type ReturnedError = GetQueryError<typeof db, typeof query, { id: string }>

expectType<ReturnedError>(toBe<DbtyperError<2400, "Unknown query parameter: name">>())
