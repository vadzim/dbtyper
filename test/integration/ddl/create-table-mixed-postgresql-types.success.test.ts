// Integration Test: CREATE TABLE with PostgreSQL-specific types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: mixed types in one table

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table mixed_types (
				id serial not null,
				created timestamptz not null,
				data bytea not null,
				duration interval not null,
				ip inet not null
			);`,
	)
	.database()

const result = await db.query(`select id, created, data, duration, ip from mixed_types;`)

type _check = Expect<
	Matches<typeof result, { id: unknown; created: unknown; data: unknown; duration: unknown; ip: unknown }[]>
>
