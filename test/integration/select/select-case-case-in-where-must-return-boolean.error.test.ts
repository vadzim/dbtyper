// Integration Test: SELECT with CASE WHEN (searched form) - CASE in WHERE must return boolean
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

// ❌ ERROR: CASE in WHERE must return boolean
const _result = _db.query(
	// @ts-expect-error
	`select * from users where case when active then 'yes' else 'no' end;`,
)
