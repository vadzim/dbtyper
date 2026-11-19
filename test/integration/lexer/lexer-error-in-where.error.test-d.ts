// Integration Test: Lexer - unterminated string literal reported from a WHERE (#117)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const base = sqlMigrations({ driver: mockDriver }).apply(`create table public.t (id int, name text);`)

const db = base.database()
const query = `SELECT id FROM public.t WHERE name = 'abc` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1002, "Unclosed string literal">>())
