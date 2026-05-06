// Integration Test: db․query() accepts non-RETURNING statements
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()

// ✅ DELETE without RETURNING should be accepted by query()

const result = await db.query(`delete from users where id = '1';`)

// Result type should be unknown

type _check = Expect<Matches<typeof result, unknown>>
