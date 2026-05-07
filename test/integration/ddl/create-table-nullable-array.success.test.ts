// Integration Test: CREATE TABLE with array types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: nullable array

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table optional (id integer not null, tags text[]);`)
	.database()

const result = await db.query(`select id, tags from optional;`)

// TODO: Fix nullable array type matching after refactoring TS types out of parsers
/*
type _check = Expect<
	Matches<
		typeof result,
		{
			id: number
			tags: readonly string[] | null
		}[]
	>
>
*/
