// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Extends, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, manager_id text);`)
	.database()

// ✅ SUCCESS: self-join
const result = db.query(
	`select u1.name as employee, u2.name as manager 
     from users u1 
     left join users u2 on u1.manager_id = u2.id;`,
)
