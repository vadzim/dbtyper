// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create schema billing;`)
	.apply(`create table users (id text not null, name text not null);`)
	.apply(`create table billing.subs (id text not null, user_id text not null);`)
	.database()

// ❌ ERROR: Unknown unqualified column in JOIN
const query = `select ghost from users join billing.subs as billing_sub on users.id = billing_sub.user_id;` as const

// @ts-expect-error
await db.query(query)

type DbShape = ApplyStatements<
	SqlDatabase,
	`create schema public; create schema billing; create table users (id text not null, name text not null); create table billing.subs (id text not null, user_id text not null);`
>[0]

type _errorCheck = Expect<
	Matches<ExtractQueryError<DbShape, typeof query>, DbtyperError<2300, "Unknown column ghost in ">>
>
