// Integration Test: CREATE TYPE - Missing comma or close paren after enum value
import { sqlMigrations, type GetApplyError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const migrations = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`)

// ❌ ERROR: Missing comma or close paren after enum value
const query = `create type status as enum ('active' garbage);` as const

// @ts-expect-error
migrations.apply(query)

type ReturnedError = GetApplyError<typeof migrations, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1808, "Expected `,` or `)` after enum value in CREATE TYPE">>())
