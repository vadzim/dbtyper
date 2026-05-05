// Integration Test: CREATE TABLE with array types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testArrayTypes() {
	// ✅ SUCCESS: text array
	const db1 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table tags (id integer not null, labels text[] not null);`)
		.database()
	const result1 = await db1.query(`select id, labels from tags;`)

	// ✅ SUCCESS: integer array
	const db2 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table scores (id integer not null, nums integer[] not null);`)
		.database()
	const result2 = await db2.query(`select id, nums from scores;`)

	// ✅ SUCCESS: uuid array
	const db3 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table refs (id integer not null, uuids uuid[] not null);`)
		.database()
	const result3 = await db3.query(`select id, uuids from refs;`)

	// ✅ SUCCESS: boolean array
	const db4 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table flags (id integer not null, bits boolean[] not null);`)
		.database()
	const result4 = await db4.query(`select id, bits from flags;`)

	// ✅ SUCCESS: nullable array
	const db5 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table optional (id integer not null, tags text[]);`)
		.database()
	const result5 = await db5.query(`select id, tags from optional;`)

	// ✅ SUCCESS: multiple array columns
	const db6 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(
			`create table multi (id integer not null, tags text[] not null, scores integer[] not null, flags boolean[] not null);`,
		)
		.database()
	const result6 = await db6.query(`select id, tags, scores, flags from multi;`)

	// ✅ SUCCESS: bigint array
	const db7 = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table big_nums (id integer not null, nums bigint[] not null);`)
		.database()
	const result7 = await db7.query(`select id, nums from big_nums;`)

	return { result1, result2, result3, result4, result5, result6, result7 }
}

testArrayTypes()
