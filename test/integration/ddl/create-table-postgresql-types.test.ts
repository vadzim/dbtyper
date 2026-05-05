// Integration Test: CREATE TABLE with PostgreSQL-specific types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testPostgresqlTypes() {
	// ✅ SUCCESS: serial types (auto-increment)
	const db1 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table counters (id serial not null, count bigserial not null, small smallserial not null);`)
		.database()
	const serial1 = await db1.query(`select id, count, small from counters;`)

	// ✅ SUCCESS: timestamptz and timetz aliases
	const db2 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table events (created_at timestamptz not null, time_only timetz not null);`)
		.database()
	const timestamps = await db2.query(`select created_at, time_only from events;`)

	// ✅ SUCCESS: bytea (binary data)
	const db3 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table files (id integer not null, data bytea not null);`)
		.database()
	const binary = await db3.query(`select id, data from files;`)

	// ✅ SUCCESS: interval (time intervals)
	const db4 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table durations (id integer not null, duration interval not null);`)
		.database()
	const intervals = await db4.query(`select id, duration from durations;`)

	// ✅ SUCCESS: inet and cidr (network addresses)
	const db5 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table hosts (id integer not null, ip inet not null, subnet cidr not null);`)
		.database()
	const network = await db5.query(`select id, ip, subnet from hosts;`)

	// ✅ SUCCESS: tsvector and tsquery (full-text search)
	const db6 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(
			`create table documents (id integer not null, search_vector tsvector not null, search_query tsquery not null);`,
		)
		.database()
	const fulltext = await db6.query(`select id, search_vector, search_query from documents;`)

	// ✅ SUCCESS: mixed types in one table
	const db7 = sqlMigrations({ driver: mockDriver })
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
	const mixed = await db7.query(`select id, created, data, duration, ip from mixed_types;`)

	return { serial1, timestamps, binary, intervals, network, fulltext, mixed }
}

testPostgresqlTypes()
