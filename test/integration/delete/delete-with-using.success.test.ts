// Integration Test: DELETE
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
	.apply(`create table banned (user_id text);`)
	.database()
// DELETE...USING clause (PostgreSQL extension)
const result = await db.query(`delete from users using banned where users.id = banned.user_id returning users.*;`)
type _check = Expect<Extends<typeof result, unknown[]>>
