// Integration Test: SELECT || concatenation error
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id uuid, name text, age integer, score numeric, active boolean);`)
	.database()

// ❌ integer || numeric → error
const _result = await _db.query(
	// @ts-expect-error
	`select 42 || 123.456 as invalid from users;`,
)
