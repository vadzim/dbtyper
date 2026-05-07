// Integration Test: DELETE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.apply(`create table banned (user_id text);`)
	.database()
// DELETE...USING clause (PostgreSQL extension)

const _result = await db.query(`delete from users using banned where users.id = banned.user_id returning users.*;`)

type _check = Expect<
	Matches<
		typeof result,
		{
			name: string
			id: string
		}[]
	>
>
