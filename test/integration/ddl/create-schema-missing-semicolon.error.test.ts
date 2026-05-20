// Integration Test: CREATE SCHEMA - Unexpected token after schema name
import { sqlMigrations, type GetApplyError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const migrations = sqlMigrations({ driver: mockDriver })

// ❌ ERROR: Unexpected token after schema name (expecting semicolon or EOT)
const query = `create schema myschema extra;` as const

// @ts-expect-error
migrations.apply(query)

type ReturnedError = GetApplyError<typeof migrations, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1105, "Expected semicolon after schema name in CREATE SCHEMA">>())
