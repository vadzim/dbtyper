// Integration Test: CORE-17 a REFERENCES target table that does not exist
import { sqlMigrations, type GetApplyError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const migrations = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`)

// ❌ ERROR: CORE-17 no table ghost yet
const query = `create table t (g integer references ghost(id));` as const

// @ts-expect-error
migrations.apply(query)

type ReturnedError = GetApplyError<typeof migrations, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<2200, "Unknown table ghost in REFERENCES">>())
