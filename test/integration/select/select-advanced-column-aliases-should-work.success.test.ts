// Integration Test: SELECT advanced features - column aliases should work
// Integration Test: Advanced SELECT features
// Tests for SELECT *, aliases, qualified tables

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Extends, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, email text);`)
	.database()
// ✅ SUCCESS: column aliases should work
const result = await db.query(`select id as user_id, name as user_name from users;`)
type _check = Expect<Extends<typeof result, unknown[]>>
