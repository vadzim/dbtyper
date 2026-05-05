// Integration Test: Array functions
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testArrayFunctions() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table items (id integer not null, tags text[] not null, nums integer[] not null);`)
		.database()

	// ✅ SUCCESS: array_length function
	const result1 = await db.query(`select array_length(tags, 1) as len from items;`)

	// ✅ SUCCESS: array_append function
	const result2 = await db.query(`select array_append(tags, 'new') as appended from items;`)

	// ✅ SUCCESS: array_prepend function
	const result3 = await db.query(`select array_prepend('first', tags) as prepended from items;`)

	// ✅ SUCCESS: unnest function
	const result4 = await db.query(`select unnest(tags) as tag from items;`)

	// ✅ SUCCESS: array_length with integer array
	const result5 = await db.query(`select array_length(nums, 1) as num_len from items;`)

	// ✅ SUCCESS: array_append with integer array
	const result6 = await db.query(`select array_append(nums, 42) as nums_appended from items;`)

	// ✅ SUCCESS: array functions with ARRAY constructor
	const result7 = await db.query(`select array_length(array['a','b','c'], 1) as literal_len from items;`)

	// ✅ SUCCESS: nested array functions
	const result8 = await db.query(`select array_length(array_append(tags, 'extra'), 1) as nested_len from items;`)

	return { result1, result2, result3, result4, result5, result6, result7, result8 }
}

testArrayFunctions()
