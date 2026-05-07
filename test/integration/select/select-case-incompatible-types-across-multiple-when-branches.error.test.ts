// Integration Test: SELECT with CASE WHEN (searched form) - Incompatible types across multiple WHEN branches
// Integration Test: SELECT with CASE WHEN (searched form)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
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

// ❌ ERROR: Incompatible types across multiple WHEN branches
const result = db.query(
	// @ts-expect-error
	`select case when age < 18 then 'minor' when age >= 18 then 42 else 'unknown' end from users;`,
)
