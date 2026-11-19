// Integration Test: STMT-19 an unknown first word far from every keyword is an error without a suggestion
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`).database()

const query = `foo bar;` as const
// @ts-expect-error
await db.query(query)
expectType<GetQueryError<typeof db, typeof query>>(
	toBe<
		DbtyperError<
			1930,
			"Unknown statement keyword foo. If this is SQL dbtyper does not know, run it with queryUntyped or streamUntyped"
		>
	>(),
)
