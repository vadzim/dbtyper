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
	.apply(`create table posts (id text, user_id text, title text);`)
	.database()
// ✅ SUCCESS: GROUP BY single column

const result = await db.query(`select user_id, count(*) as post_count from posts group by user_id;`)

type _check = Expect<
	Matches<
		typeof result,
		{
			user_id: string
			post_count: bigint
		}[]
	>
>
