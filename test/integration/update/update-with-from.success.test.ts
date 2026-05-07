// Integration Test: UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.apply(`create table posts (id text, user_id text, title text);`)
	.database()
// UPDATE...FROM clause (PostgreSQL extension)

const result = await db.query(
	`update users set name = 'Author' from posts where users.id = posts.user_id returning users.*;`,
)

type _check = Expect<
	Matches<
		typeof result,
		{
			name: string
			id: string
		}[]
	>
>
