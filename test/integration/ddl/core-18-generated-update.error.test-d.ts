// Integration Test: CORE-18 writing a generated column in UPDATE is an error
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table t (id integer not null, a integer not null, g integer not null generated always as (a + 1) stored);`,
	)
	.database()

// ❌ ERROR: CORE-18 g is generated
const query = `update t set g = 5;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<3512, "Cannot write generated column g in UPDATE SET">>())
