// Integration Test: DROP TYPE - Missing EXISTS after IF
import { sqlMigrations, type GetApplyError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const migrations = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create type status as enum ('active');`)

// ❌ ERROR: Missing EXISTS after IF in DROP TYPE
const query = `drop type if status;` as const

// @ts-expect-error
migrations.apply(query)

type ReturnedError = GetApplyError<typeof migrations, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1817, "Expected `exists` after `IF` in DROP TYPE">>())
