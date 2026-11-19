// Integration Test: STMT-19 a typo as the first word is a compile error naming the word and the closest keyword
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id int not null);`)
	.database()

const select = `selec id from users` as const
// @ts-expect-error
await db.query(select)
expectType<GetQueryError<typeof db, typeof select>>(
	toBe<
		DbtyperError<
			1931,
			"Unknown statement keyword selec; did you mean SELECT? If this is SQL dbtyper does not know, run it with queryUntyped or streamUntyped"
		>
	>(),
)

const update = `udpate users set id = 1` as const
// @ts-expect-error
await db.query(update)
expectType<GetQueryError<typeof db, typeof update>>(
	toBe<
		DbtyperError<
			1931,
			"Unknown statement keyword udpate; did you mean UPDATE? If this is SQL dbtyper does not know, run it with queryUntyped or streamUntyped"
		>
	>(),
)
