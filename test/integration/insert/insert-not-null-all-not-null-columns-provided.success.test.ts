// Integration Test: INSERT NOT NULL validation - all NOT NULL columns provided
// Integration Test: INSERT - require values for NOT NULL columns without defaults
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text not null, name text not null, email text);`)
	.database()
// ✅ SUCCESS: all NOT NULL columns provided
const result = await db.query(`insert into users (id, name) values ('1', 'Alice') returning *;`)
type _check = Expect<Matches<typeof result, Array<{ id: string; name: string; email: string }>>>
