// Integration Test: ALTER TYPE - Missing type name
import { sqlMigrations, type GetApplyError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const migrations = sqlMigrations({ driver: mockDriver }).apply(`create type status as enum ('active');`)

// ❌ ERROR: Missing type name in ALTER TYPE
const query = `alter type add value 'inactive';` as const

// @ts-expect-error
migrations.apply(query)

type ReturnedError = GetApplyError<typeof migrations, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<4105, "Expected type name in ALTER TYPE">>())
