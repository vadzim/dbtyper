// Integration Test: INSERT NOT NULL validation - missing NOT NULL column 'name'
// Integration Test: INSERT - require values for NOT NULL columns without defaults
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text not null, name text not null, email text);`)
	.database()

// ❌ ERROR: missing NOT NULL column 'name'
const _result = _db.query(
	// @ts-expect-error
	`insert into users (id) values ('3') returning *;`,
)
