// Variant 1: Current API (baseline)
// This is an exact copy of the current API for comparison

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testVariant1() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ Valid query
	const good = await db.query(`select id, name from users;`)

	// ❌ Invalid query - should produce an error
	// const bad = await db.query(`select invalid_column from users;`)
	// error TS2345: Argument of type '"select invalid_column from users;"'
	// is not assignable to parameter of type '"Unknown column"'.

	return { good }
}

export { testVariant1 }

/**
 * VARIANT 1: Current API
 *
 * Structure:
 * - sqlMigrations({ driver }).apply(...).database()
 * - db.query(sql) → Promise<Array<Row>>
 * - db.stream(sql) → AsyncIterable<Row>
 * - db.queryUntyped(sql) → Promise<Array<any>>
 *
 * Validation:
 * - CheckSqlValid<Db, Stmt> in the parameter constraint
 * - Errors are shown as TS2345
 *
 * Advantages:
 * ✅ Simple and intuitive
 * ✅ Validation works
 * ✅ Aligns with the "plain SQL" philosophy
 *
 * Disadvantages:
 * ❌ Error messages could be clearer
 * ❌ No way to validate SQL without execution
 */
