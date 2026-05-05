// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, email text);`)
	.database()

// ✅ SUCCESS: RETURNING specific columns
const result = await db.query(
	`insert into users (id, name, email) values ('1', 'Alice', 'alice@example.com') returning id, name;`,
)

// Type should be: Array<{ id: string; name: string }>
const _typeCheck: typeof result = [] as Array<{
	id: string
	name: string
}>
