// Integration Test: SELECT with CASE WHEN (searched form)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testCaseSearchedSuccess() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(
			`create table users (
				id text not null,
				name text not null,
				age integer not null,
				active boolean not null
			);`,
		)
		.database()

	// ✅ SUCCESS: Basic CASE WHEN with boolean condition
	const result1 = await db.query(`
		select
			name,
			case
				when age >= 18 then 'adult'
				else 'minor'
			end as category
		from users;
	`)

	// ✅ SUCCESS: Multiple WHEN clauses
	const result2 = await db.query(`
		select
			name,
			case
				when age < 13 then 'child'
				when age < 18 then 'teen'
				when age < 65 then 'adult'
				else 'senior'
			end as age_group
		from users;
	`)

	// ✅ SUCCESS: CASE without ELSE (returns NULL)
	const result3 = await db.query(`
		select
			name,
			case
				when active then 'yes'
			end as is_active
		from users;
	`)

	// ✅ SUCCESS: CASE in WHERE clause
	const result4 = await db.query(`
		select * from users
		where case
			when age < 18 then false
			else true
		end;
	`)

	// ✅ SUCCESS: Nested CASE expressions
	const result5 = await db.query(`
		select
			name,
			case
				when active then case
					when age >= 18 then 'active adult'
					else 'active minor'
				end
				else 'inactive'
			end as status
		from users;
	`)

	return { result1, result2, result3, result4, result5 }
}

async function testCaseSearchedErrors() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(
			`create table users (
				id text not null,
				name text not null,
				age integer not null,
				active boolean not null
			);`,
		)
		.database()

	// ❌ ERROR: WHEN condition must be boolean, not integer
	const bad1 = await db.query(
		// @ts-expect-error
		`select case when age then 'yes' else 'no' end from users;`,
	)

	// ❌ ERROR: WHEN condition must be boolean, not text
	const bad2 = await db.query(
		// @ts-expect-error
		`select case when name then 'yes' else 'no' end from users;`,
	)

	// ❌ ERROR: Incompatible types in THEN/ELSE branches
	const bad3 = await db.query(
		// @ts-expect-error
		`select case when active then 'text' else 123 end from users;`,
	)

	// ❌ ERROR: Incompatible types across multiple WHEN branches
	const bad4 = await db.query(
		// @ts-expect-error
		`select case when age < 18 then 'minor' when age >= 18 then 42 else 'unknown' end from users;`,
	)

	// ❌ ERROR: CASE in WHERE must return boolean
	const bad5 = await db.query(
		// @ts-expect-error
		`select * from users where case when active then 'yes' else 'no' end;`,
	)

	// ❌ ERROR: Boolean THEN with integer ELSE
	const bad6 = await db.query(
		// @ts-expect-error
		`select case when active then true else 0 end from users;`,
	)

	return { bad1, bad2, bad3, bad4, bad5, bad6 }
}

testCaseSearchedSuccess()
testCaseSearchedErrors()
