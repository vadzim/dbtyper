// Integration Test: SELECT - Expected SELECT after WITH
// Integration Test: WITH clause syntax validation
// Tests that WITH clause must be followed by SELECT, INSERT, UPDATE or DELETE (SEL-21, DML-21), not other statements

import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table users (id integer, name text);`).database()

// ❌ ERROR: WITH must be followed by SELECT, INSERT, UPDATE or DELETE, not CREATE TABLE
const query = `WITH cte AS (SELECT 1 AS a) CREATE TABLE x (a integer); SELECT * FROM users;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1100, "Expected SELECT, INSERT, UPDATE or DELETE after WITH clause">>())
