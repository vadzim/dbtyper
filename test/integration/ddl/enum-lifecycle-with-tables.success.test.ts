// Integration Test: Full enum type lifecycle (CREATE, ALTER, DROP)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ✅ SUCCESS: Schema with both tables and types
const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create type status as enum ('active', 'inactive');`)
	.apply(`create table users (id integer not null, name text not null);`)
	.apply(`alter type status add value 'pending';`)
	.apply(`create table posts (id integer not null, title text not null);`)
	.database()
