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
// ✅ SUCCESS: INSERT multiple rows
const result = await db.query(
	`insert into users (id, name) values ('1', 'Alice'), ('2', 'Bob'), ('3', 'Charlie') returning *;`,
)
type _check = Expect<Matches<typeof result, Array<{ id: string; name: string }>>>
