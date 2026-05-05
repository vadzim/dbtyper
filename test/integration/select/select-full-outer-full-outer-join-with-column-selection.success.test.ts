// Integration Test: SELECT with FULL OUTER JOIN - FULL OUTER JOIN with column selection
// Integration Test: FULL OUTER JOIN
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Extends, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null);`)
	.apply(`create table orders (id integer not null, user_id integer not null, total integer not null);`)
	.database()
// ✅ SUCCESS: FULL OUTER JOIN with column selection
const result = await db.query(
	`select users.name, orders.total from users full outer join orders on users.id = orders.user_id;`,
)
type _check = Expect<Matches<typeof result, { name: string; total: number }[]>>
