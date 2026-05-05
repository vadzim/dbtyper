// Integration Test: SELECT with CASE expr WHEN (simple form)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testCaseSimpleSuccess() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(
			`create table users (
				id text not null,
				status text not null,
				role text not null,
				priority integer not null
			);`,
		)
		.database()

	// ✅ SUCCESS: Basic simple CASE with text comparison
	const result1 = await db.query(`
		select
			status,
			case status
				when 'active' then 'Active User'
				when 'inactive' then 'Inactive User'
				else 'Unknown'
			end as status_label
		from users;
	`)

	// ✅ SUCCESS: Simple CASE with integer comparison
	const result2 = await db.query(`
		select
			priority,
			case priority
				when 1 then 'high'
				when 2 then 'medium'
				when 3 then 'low'
				else 'unknown'
			end as priority_name
		from users;
	`)

	// ✅ SUCCESS: Simple CASE without ELSE
	const result3 = await db.query(`
		select
			role,
			case role
				when 'admin' then 'Administrator'
				when 'user' then 'Regular User'
			end as role_label
		from users;
	`)

	// ✅ SUCCESS: Simple CASE in WHERE clause
	const result4 = await db.query(`
		select * from users
		where case status
			when 'active' then true
			else false
		end;
	`)

	return { result1, result2, result3, result4 }
}

async function testCaseSimpleErrors() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(
			`create table users (
				id text not null,
				status text not null,
				priority integer not null,
				active boolean not null
			);`,
		)
		.database()

	// ❌ ERROR: WHEN value type mismatch (text discriminant, integer WHEN)
	const bad1 = await db.query(
		// @ts-expect-error
		`select case status when 123 then 'yes' else 'no' end from users;`,
	)

	// ❌ ERROR: WHEN value type mismatch (integer discriminant, text WHEN)
	const bad2 = await db.query(
		// @ts-expect-error
		`select case priority when 'high' then 1 else 0 end from users;`,
	)

	// ❌ ERROR: Incompatible THEN/ELSE types
	const bad3 = await db.query(
		// @ts-expect-error
		`select case status when 'active' then 'yes' when 'inactive' then 42 else 'no' end from users;`,
	)

	// ❌ ERROR: Boolean discriminant with text WHEN values
	const bad4 = await db.query(
		// @ts-expect-error
		`select case active when 'true' then 'yes' else 'no' end from users;`,
	)

	// ❌ ERROR: Simple CASE in WHERE must return boolean
	const bad5 = await db.query(
		// @ts-expect-error
		`select * from users where case status when 'active' then 'yes' else 'no' end;`,
	)

	return { bad1, bad2, bad3, bad4, bad5 }
}

testCaseSimpleSuccess()
testCaseSimpleErrors()
