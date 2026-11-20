// Integration Test: CORE-11 Check: duplicate output column id is 3410
// SKIPPED (SPEC-Q CORE-11): the Check says the message is `Duplicate output column id; ...`, the code says `Duplicate output column \`id\`; ...` (backticks around the name, as in the existing test core-11-duplicate-output-column).
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table users (id integer not null, name text not null, email text); create table posts (id integer not null, user_id integer not null, title text);`,
	)
	.database()

// ❌ ERROR: CORE-11
const query = `select users.id, posts.id from users join posts on posts.user_id = users.id` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<3410, "Duplicate output column id; use AS to give one of them an alias">>())
