// Integration Test: DELETE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.apply(`create table banned (user_id text);`)
	.database()
// DELETE...USING clause (PostgreSQL extension)

const _result = await _db.query(`delete from users using banned where users.id = banned.user_id returning users.*;`)

expectType<typeof _result>(
	toBe<
		{
			name: string | null
			id: string | null
		}[]
	>(),
)
