// Integration Test: ALTER TYPE - Expected ADD in ALTER TYPE
import { sqlMigrations, type GetApplyError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const migrations = sqlMigrations({ driver: mockDriver }).apply(`create type public.status as enum ('active');`)

// ❌ ERROR: Expected ADD in ALTER TYPE (qualified name followed by non-add token)
const query = `alter type public.status value 'inactive';` as const

// @ts-expect-error
migrations.apply(query)

type ReturnedError = GetApplyError<typeof migrations, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1813, "Expected `add` in ALTER TYPE">>())
