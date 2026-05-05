// Integration Test: INSERT
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
// ✅ SUCCESS: NULL into nullable column
const result = await db.query(`insert into users (id, name) values ('1', null) returning *;`)
type _check = Expect<Matches<typeof result, Array<{ id: string; name: string }>>>
