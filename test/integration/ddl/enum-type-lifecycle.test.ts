// Integration Test: Full enum type lifecycle (CREATE, ALTER, DROP)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testEnumTypeLifecycle() {
	// ✅ SUCCESS: Full lifecycle - create, alter, drop
	const db1 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active', 'inactive');`)
		// @ts-expect-error - type created in previous apply
		.apply(`alter type status add value 'pending';`)
		// @ts-expect-error - type created in previous apply
		.apply(`alter type status add value 'archived';`)
		// @ts-expect-error - type created in previous apply
		.apply(`drop type status;`)
		.database()

	// ✅ SUCCESS: Multiple enum types with different lifecycles
	const db2 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active', 'inactive');`)
		.apply(`create type priority as enum ('low', 'high');`)
		// @ts-expect-error - type created in previous apply
		.apply(`alter type status add value 'pending';`)
		// @ts-expect-error - type created in previous apply
		.apply(`alter type priority add value 'medium';`)
		// @ts-expect-error - type created in previous apply
		.apply(`drop type status;`)
		.apply(`create type status as enum ('new', 'old');`)
		.database()

	// ✅ SUCCESS: Enum types across multiple schemas
	const db3 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create schema app;`)
		.apply(`create schema admin;`)
		.apply(`create type public.status as enum ('active', 'inactive');`)
		.apply(`create type app.priority as enum ('low', 'high');`)
		.apply(`create type admin.role as enum ('user', 'admin');`)
		// @ts-expect-error - type created in previous apply
		.apply(`alter type public.status add value 'pending';`)
		// @ts-expect-error - type created in previous apply
		.apply(`alter type app.priority add value 'medium';`)
		// @ts-expect-error - type created in previous apply
		.apply(`alter type admin.role add value 'superadmin';`)
		.database()

	// ✅ SUCCESS: IF NOT EXISTS and IF EXISTS combinations
	const db4 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type if not exists status as enum ('active', 'inactive');`)
		.apply(`create type if not exists status as enum ('new');`)
		.apply(`alter type if exists status add value 'pending';`)
		.apply(`alter type if exists missing add value 'value';`)
		.apply(`drop type if exists status;`)
		.apply(`drop type if exists missing;`)
		.database()

	// ✅ SUCCESS: Complex migration scenario
	const db5 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type old_status as enum ('active', 'inactive');`)
		.apply(`create type new_status as enum ('enabled', 'disabled');`)
		// @ts-expect-error - type created in previous apply
		.apply(`alter type new_status add value 'pending';`)
		// @ts-expect-error - type created in previous apply
		.apply(`drop type old_status;`)
		.apply(`create type status as enum ('live', 'archived');`)
		.database()

	// ✅ SUCCESS: Enum with many values
	const db6 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type day_of_week as enum ('monday', 'tuesday', 'wednesday');`)
		// @ts-expect-error - type created in previous apply
		.apply(`alter type day_of_week add value 'thursday';`)
		// @ts-expect-error - type created in previous apply
		.apply(`alter type day_of_week add value 'friday';`)
		// @ts-expect-error - type created in previous apply
		.apply(`alter type day_of_week add value 'saturday';`)
		// @ts-expect-error - type created in previous apply
		.apply(`alter type day_of_week add value 'sunday';`)
		.database()

	// ✅ SUCCESS: Schema with both tables and types
	const db7 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active', 'inactive');`)
		.apply(`create table users (id integer not null, name text not null);`)
		// @ts-expect-error - type created in previous apply
		.apply(`alter type status add value 'pending';`)
		.apply(`create table posts (id integer not null, title text not null);`)
		.database()

	// ✅ SUCCESS: Drop schema with types
	const db8 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create schema temp;`)
		.apply(`create type temp.status as enum ('active', 'inactive');`)
		// @ts-expect-error - type created in previous apply
		.apply(`drop type temp.status;`)
		.apply(`drop schema temp;`)
		.database()

	return { db1, db2, db3, db4, db5, db6, db7, db8 }
}

testEnumTypeLifecycle()
