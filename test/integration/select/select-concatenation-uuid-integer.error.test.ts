// Integration Test: SELECT || concatenation error
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id uuid, name text, age integer, score numeric, active boolean);`)
	.database()

// ❌ uuid || integer → error
const _result = await db.query(
	// @ts-expect-error
	`select id || 42 as invalid from users;`,
)
