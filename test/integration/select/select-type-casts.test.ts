// Integration Test: PostgreSQL type casts (::type)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testTypeCasts() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table data (id integer not null, value text not null, num integer not null);`)
		.database()

	// ✅ SUCCESS: Cast number literal to text (like existing test)
	const cast1 = await db.query(`select 42::text as num_text from data;`)

	// ✅ SUCCESS: Cast integer column to text
	const cast2 = await db.query(`select id::text as id_text from data;`)

	// ✅ SUCCESS: Cast text to uuid
	const cast3 = await db.query(`select value::uuid as value_uuid from data;`)

	// ✅ SUCCESS: Cast in WHERE clause
	const cast4 = await db.query(`select * from data where id::text = '123';`)

	return {
		cast1,
		cast2,
		cast3,
		cast4,
	}
}

async function testTypeCastErrors() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table data (id integer not null, value text not null, flag boolean not null);`)
		.database()

	// ❌ ERROR: Cannot cast integer to boolean
	const bad1 = await db.query(
		// @ts-expect-error
		`select id::boolean from data;`,
	)

	// ❌ ERROR: Cannot cast boolean to integer
	const bad2 = await db.query(
		// @ts-expect-error
		`select flag::integer from data;`,
	)

	// ❌ ERROR: Cannot cast integer to uuid (uuid requires string)
	const bad3 = await db.query(`select id::uuid from data;`)

	return { bad1, bad2, bad3 }
}

testTypeCasts()
testTypeCastErrors()
