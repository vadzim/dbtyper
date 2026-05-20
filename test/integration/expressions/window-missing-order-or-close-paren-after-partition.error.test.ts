// Integration Test: Window Function Syntax
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, dept text not null);`)
	.database()

// ❌ ERROR: Expected ORDER BY or ) after PARTITION BY
const query = `select row_number() over (partition by dept limit 1) as rn from users;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<4603, "Expected ORDER BY or ) after PARTITION BY">>())
