// Integration Test: CREATE TABLE with DEFAULT values
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ❌ ERROR: CREATE TABLE with wrong DEFAULT values should throw an error

const migrations = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`)

migrations.apply(
	// @ts-expect-error
	`create table users (
				id text not null,
				name text not null,
				email text,
				age numeric default 'xxx',
				active boolean default true,
				created_at timestamp default now()
			);`,
)
