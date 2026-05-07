// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, email text);`)
	.database()

// ✅ SUCCESS: RETURNING specific columns

const result = await db.query(
	`insert into users (id, name, email) values ('1', 'Alice', 'alice@example.com') returning id, name;`,
)

type _check = Expect<
	Matches<
		typeof result,
		Array<{
			id: string
			name: string
		}>
	>
>
