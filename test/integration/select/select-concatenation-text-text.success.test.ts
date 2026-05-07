// Integration Test: SELECT || concatenation success
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id uuid, name text, age integer, score numeric, active boolean);`)
	.database()

// ✅ text || text → text
const result = await db.query(`select 'hello' || ' world' as greeting from users;`)
type _check = Expect<Matches<typeof result, Array<{ greeting: string }>>>
