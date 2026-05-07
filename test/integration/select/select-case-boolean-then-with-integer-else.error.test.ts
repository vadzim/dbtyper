// Integration Test: SELECT with CASE WHEN (searched form) - Boolean THEN with integer ELSE
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

// ❌ ERROR: Boolean THEN with integer ELSE
const result = db.query(
	// @ts-expect-error
	`select case when active then true else 0 end from users;`,
)
