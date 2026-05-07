// Integration Test: CREATE TABLE with DEFAULT values
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: CREATE TABLE with DEFAULT values should parse

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table users (
				id text not null,
				name text not null,
				email text,
				age numeric default 18,
				active boolean default true,
				created_at timestamp default now()
			);`,
	)
