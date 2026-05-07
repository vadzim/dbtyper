// Integration Test: SELECT with CASE WHEN (searched form) - Incompatible types in THEN/ELSE branches
// Integration Test: SELECT with CASE WHEN (searched form)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table users (
				id text not null,
				name text not null,
				age integer not null,
				active boolean not null
			);`,
	)
	.database()

// ❌ ERROR: Incompatible types in THEN/ELSE branches
const _result = _db.query(
	// @ts-expect-error
	`select case when active then 'text' else 123 end from users;`,
)
