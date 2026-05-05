// Integration Test: Array operators
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testArrayOperators() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table items (id integer not null, tags text[] not null, nums integer[] not null);`)
		.database()

	// ✅ SUCCESS: <@ (is contained by) operator
	const result1 = await db.query(`select tags <@ array['a','b','c'] as contained from items;`)

	// ✅ SUCCESS: @> (contains) operator - already working
	const result2 = await db.query(`select tags @> array['a'] as contains from items;`)

	// ✅ SUCCESS: && (overlaps) operator - already working
	const result3 = await db.query(`select tags && array['a','b'] as overlaps from items;`)

	// ✅ SUCCESS: = (array equality) operator
	const result4 = await db.query(`select tags = array['a','b'] as equals from items;`)

	// ✅ SUCCESS: || (array concatenation) operator
	const result5 = await db.query(`select tags || array['new'] as concatenated from items;`)

	// ✅ SUCCESS: Array concatenation with column
	const result6 = await db.query(`select tags || tags as doubled from items;`)

	// ✅ SUCCESS: Multiple operators in WHERE
	const result7 = await db.query(`select * from items where tags @> array['important'];`)

	// ✅ SUCCESS: Array equality in WHERE
	const result8 = await db.query(`select * from items where tags = array['a','b'];`)

	return { result1, result2, result3, result4, result5, result6, result7, result8 }
}

testArrayOperators()
