// Integration Test: ANY/ALL/SOME operators
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testAnyAllSomeOperators() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table items (id integer not null, tags text[] not null, priority integer not null);`)
		.apply(`create table priorities (value integer not null);`)
		.database()

	// ✅ SUCCESS: = ANY with array
	const result1 = await db.query(`select * from items where id = any(array[1,2,3]);`)

	// ✅ SUCCESS: = ANY with column array
	const result2 = await db.query(`select * from items where 'important' = any(tags);`)

	// ✅ SUCCESS: = ALL with array
	const result3 = await db.query(`select * from items where priority = all(array[1,1,1]);`)

	// ✅ SUCCESS: = SOME with array (alias for ANY)
	const result4 = await db.query(`select * from items where id = some(array[5,6,7]);`)

	// ✅ SUCCESS: < ANY with array
	const result5 = await db.query(`select * from items where priority < any(array[10,20,30]);`)

	// ✅ SUCCESS: > ALL with array
	const result6 = await db.query(`select * from items where priority > all(array[1,2,3]);`)

	// ✅ SUCCESS: ANY with subquery
	const result7 = await db.query(`select * from items where priority = any(select value from priorities);`)

	// ✅ SUCCESS: ALL with subquery
	const result8 = await db.query(`select * from items where priority >= all(select value from priorities);`)

	// ✅ SUCCESS: SOME with subquery
	const result9 = await db.query(`select * from items where priority = some(select value from priorities);`)

	// ✅ SUCCESS: <> ANY with array
	const result10 = await db.query(`select * from items where id <> any(array[1,2,3]);`)

	return { result1, result2, result3, result4, result5, result6, result7, result8, result9, result10 }
}

testAnyAllSomeOperators()
