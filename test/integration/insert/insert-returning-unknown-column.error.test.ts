// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()

// ❌ ERROR: RETURNING unknown column
await db.query(
	// @ts-expect-error
	`insert into users (id, name) values ('1', 'Alice') returning invalid_column;`,
)
