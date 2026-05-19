// Integration Test: Positional Parameters - Arithmetic with invalid types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { type ExpectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"
import type { GetQueryError } from "../../../src/core/sql-database.ts"
import type { SqlInteger, SqlText } from "../../../src/core/sql-type-shape.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`).database()

// ❌ ERROR: multiplication with number and string should fail
const query = `select ? * ? as result;` as const

// @ts-expect-error
await db.query(query, [5, "hello"])

const _test: ExpectType<GetQueryError<typeof db, typeof query, readonly [SqlInteger, SqlText]>> =
	toBe<DbtyperError<2501, "Incompatible types in arithmetic">>()
