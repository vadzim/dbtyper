// Integration Test: STMT-19 a typo of update is an error naming the word and suggesting update
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table users (id int not null);`).database()

const query = `udpate users set id = 1` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(
	toBe<
		DbtyperError<
			1931,
			"Unknown statement keyword udpate; did you mean UPDATE? If this is SQL dbtyper does not know, run it with queryUntyped or streamUntyped"
		>
	>(),
)
