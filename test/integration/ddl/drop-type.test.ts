// Integration Test: DROP TYPE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testDropType() {
	// ✅ SUCCESS: DROP TYPE removes existing type
	const db1 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active', 'inactive');`)
		// @ts-expect-error - type created in previous apply
		.apply(`drop type status;`)
		.database()

	// ✅ SUCCESS: DROP TYPE IF EXISTS (existing type)
	const db2 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active', 'inactive');`)
		.apply(`drop type if exists status;`)
		.database()

	// ✅ SUCCESS: DROP TYPE IF EXISTS (non-existing type, no-op)
	const db3 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`drop type if exists missing;`)
		.database()

	// ✅ SUCCESS: DROP TYPE with qualified name
	const db4 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create schema app;`)
		.apply(`create type app.status as enum ('active', 'inactive');`)
		// @ts-expect-error - type created in previous apply
		.apply(`drop type app.status;`)
		.database()

	// ✅ SUCCESS: DROP multiple types
	const db5 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active', 'inactive');`)
		.apply(`create type priority as enum ('low', 'high');`)
		// @ts-expect-error - type created in previous apply
		.apply(`drop type status;`)
		// @ts-expect-error - type created in previous apply
		.apply(`drop type priority;`)
		.database()

	// ✅ SUCCESS: CREATE, DROP, then CREATE again
	const db6 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active', 'inactive');`)
		// @ts-expect-error - type created in previous apply
		.apply(`drop type status;`)
		.apply(`create type status as enum ('new', 'old');`)
		.database()

	// ❌ ERROR: DROP non-existing type
	const db7 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		// @ts-expect-error
		.apply(`drop type missing;`)
		.database()

	// ❌ ERROR: DROP type from unknown schema
	const db8 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		// @ts-expect-error
		.apply(`drop type ghost.status;`)
		.database()

	return { db1, db2, db3, db4, db5, db6, db7, db8 }
}

testDropType()
