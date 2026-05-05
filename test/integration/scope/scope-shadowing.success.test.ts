// Integration Test: Scope Shadowing
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testScopeShadowing() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text);`)
		.database()

	// ✅ SUCCESS: CTE shadows table with same name
	const cteShadowsTable = await db.query(`
		with users as (select id from posts)
		select id from users;
	`)

	// ✅ SUCCESS: Table alias shadows table name
	const aliasShadowsTable = await db.query(`
		select posts.id from users as posts;
	`)

	// ✅ SUCCESS: Derived table alias shadows table name
	const derivedShadowsTable = await db.query(`
		select posts.derived_col 
		from (select 'test' as derived_col from users) as posts;
	`)

	// ✅ SUCCESS: Subquery FROM scope shadows outer FROM scope
	const subqueryShadowsOuter = await db.query(`
		select 
			(select posts.id from users as posts) as inner_id,
			posts.user_id as outer_user_id
		from posts;
	`)

	return {
		cteShadowsTable,
		aliasShadowsTable,
		derivedShadowsTable,
		subqueryShadowsOuter,
	}
}

testScopeShadowing()
