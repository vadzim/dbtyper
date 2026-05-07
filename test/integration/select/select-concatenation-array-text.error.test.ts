// Integration Test: SELECT || array concatenation with text (error)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer, tags integer[]);`)
	.database()

// ❌ array || text → error
const _result = await db.query(
	// @ts-expect-error
	`select array[2,3] || '4' as result from users;`,
)
