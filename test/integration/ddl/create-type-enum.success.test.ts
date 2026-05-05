// Integration Test: CREATE TYPE ... AS ENUM
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testCreateTypeEnum() {
	// ✅ SUCCESS: CREATE TYPE with enum values
	const db1 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active', 'inactive', 'pending');`)
		.database()

	// ✅ SUCCESS: CREATE TYPE IF NOT EXISTS (new type)
	const db2 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type if not exists priority as enum ('low', 'medium', 'high');`)
		.database()

	// ✅ SUCCESS: CREATE TYPE IF NOT EXISTS (existing type, no-op)
	const db3 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active', 'inactive');`)
		.apply(`create type if not exists status as enum ('new');`)
		.database()

	// ✅ SUCCESS: Multiple enum types in same schema
	const db4 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active', 'inactive');`)
		.apply(`create type priority as enum ('low', 'high');`)
		.apply(`create type color as enum ('red', 'green', 'blue');`)
		.database()

	// ✅ SUCCESS: Qualified type name with schema
	const db5 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create schema app;`)
		.apply(`create type app.status as enum ('active', 'inactive');`)
		.database()

	// ✅ SUCCESS: Single enum value
	const db6 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type singleton as enum ('only');`)
		.database()

	// ❌ FAILURE: Duplicate type name
	const db7 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active');`)
		.apply(
			// @ts-expect-error
			`create type status as enum ('new');`,
		)
		.database()

	// ❌ FAILURE: Empty enum values
	const db8 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(
			// @ts-expect-error
			`create type empty as enum ();`,
		)
		.database()

	// ❌ FAILURE: Unknown schema
	const db9 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(
			// @ts-expect-error
			`create type ghost.status as enum ('active');`,
		)
		.database()

	// ❌ FAILURE: Missing AS keyword
	const db10 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(
			// @ts-expect-error
			`create type status enum ('active');`,
		)
		.database()

	// ❌ FAILURE: Missing ENUM keyword
	const db11 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(
			// @ts-expect-error
			`create type status as ('active');`,
		)
		.database()

	return { db1, db2, db3, db4, db5, db6, db7, db8, db9, db10, db11 }
}

testCreateTypeEnum()
