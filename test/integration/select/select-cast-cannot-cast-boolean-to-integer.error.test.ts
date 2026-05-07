// Integration Test: SELECT with type casts - Cannot cast boolean to integer
// Integration Test: PostgreSQL type casts (::type)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table data (id integer not null, value text not null, num integer not null);`)
	.database()

// ❌ ERROR: Cannot cast boolean to integer
const result = db.query(
	// @ts-expect-error
	`select flag::integer from data;`,
)
