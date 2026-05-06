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
	.apply(`create table users (id text, name text);`)
	.apply(`create table roles (id text, role_name text);`)
	.database()
// ✅ SUCCESS: CROSS JOIN (Cartesian product)

const result = await db.query(`select users.name, roles.role_name from users cross join roles;`)

type _check = Expect<
	Matches<
		typeof result,
		{
			name: string
			role_name: string
		}[]
	>
>
