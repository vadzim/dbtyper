// Integration Test: INSERT with defaults - still must provide NOT NULL columns without DEFAULT
// Integration Test: INSERT with DEFAULT columns
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table users (
				id text not null,
				name text not null,
				age numeric not null default 18,
				active boolean not null default true,
				created_at timestamp default now()
			);`,
	)
	.database()

// ❌ ERROR: still must provide NOT NULL columns without DEFAULT
const _result = db.query(
	// @ts-expect-error
	`insert into users (age) values (20) returning *;`,
)
