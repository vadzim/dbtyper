// Integration Test: DROP TYPE - Expected semicolon after DROP TYPE
import { sqlMigrations, type GetApplyError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const migrations = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create type public.status as enum ('active');`)

// ❌ ERROR: Expected semicolon after DROP TYPE (qualified name)
const query = `drop type public.status trailing` as const

// @ts-expect-error
migrations.apply(query)

type ReturnedError = GetApplyError<typeof migrations, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1105, "Expected semicolon after DROP TYPE">>())
