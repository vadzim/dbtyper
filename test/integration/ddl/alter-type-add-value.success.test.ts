// Integration Test: ALTER TYPE ... ADD VALUE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testAlterTypeAddValue() {
	// ✅ SUCCESS: ALTER TYPE ADD VALUE to existing enum
	const db1 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active', 'inactive');`)
		.apply(`alter type status add value 'pending';`)
		.database()

	// ✅ SUCCESS: ALTER TYPE ADD VALUE multiple times
	const db2 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active');`)
		.apply(`alter type status add value 'inactive';`)
		.apply(`alter type status add value 'pending';`)
		.apply(`alter type status add value 'archived';`)
		.database()

	// ✅ SUCCESS: ALTER TYPE IF EXISTS (existing type)
	const db3 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active', 'inactive');`)
		.apply(`alter type if exists status add value 'pending';`)
		.database()

	// ✅ SUCCESS: ALTER TYPE IF EXISTS (non-existing type, no-op)
	const db4 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`alter type if exists missing add value 'new';`)
		.database()

	// ✅ SUCCESS: ALTER TYPE with qualified name
	const db5 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create schema app;`)
		.apply(`create type app.status as enum ('active', 'inactive');`)
		.apply(`alter type app.status add value 'pending';`)
		.database()

	// ✅ SUCCESS: Add value with special characters
	const db6 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active');`)
		.apply(`alter type status add value 'in-progress';`)
		.apply(`alter type status add value 'waiting_approval';`)
		.database()

	// ❌ ERROR: ALTER non-existing type
	const db7 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(
			// @ts-expect-error
			`alter type missing add value 'new';`,
		)
		.database()

	// ❌ ERROR: Add duplicate value
	const db8 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active', 'inactive');`)
		.apply(
			// @ts-expect-error
			`alter type status add value 'active';`,
		)
		.database()

	// ❌ ERROR: ALTER type from unknown schema
	const db9 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(
			// @ts-expect-error
			`alter type ghost.status add value 'new';`,
		)
		.database()

	return { db1, db2, db3, db4, db5, db6, db7, db8, db9 }
}

testAlterTypeAddValue()
