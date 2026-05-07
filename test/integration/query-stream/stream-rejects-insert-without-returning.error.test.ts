// Integration Test: _db․stream() rejects non-RETURNING statements
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()

// ❌ INSERT without RETURNING should be rejected by stream()
_db.stream(
	// @ts-expect-error
	`insert into users (id, name) values ('1', 'Alice');`,
)
