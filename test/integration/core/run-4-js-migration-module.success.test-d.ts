// RUN-4: SQL produced by migration() in a plain .js module keeps its literal type and types `auth.users`.
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { generateSql } from "../../runtime/migration-modules/002.do.users.js"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create schema auth;`).apply(generateSql()).database()

const _result = await db.query(`select id, age from auth.users;`)

expectType<typeof _result>(toBe<Array<{ id: string; age: number | null }>>())
