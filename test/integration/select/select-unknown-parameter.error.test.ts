// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { toBe, type ExpectType } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"
import type { GetQueryError } from "../../../src/core/sql-database.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text not null, name text not null);`)
	.database()

// ❌ ERROR: Unknown query parameter in SELECT
const query = `select :limit, users.id from users;` as const

// @ts-expect-error
await db.query(query)

const _test: ExpectType<GetQueryError<typeof db, typeof query>> =
	toBe<DbtyperError<1105, "Expected semicolon after SELECT">>()
