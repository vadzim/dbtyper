// Variant 2: API with explicit validation method
// Idea: Add .validateQuery() to validate SQL without execution

/**
 * VARIANT 2: Explicit Validation
 *
 * Proposed changes in src/core/sql-database.ts:
 *
 * export type DataBase<Db> = {
 *   // Existing methods
 *   query<Stmt>(statement: Stmt extends CheckSqlValid<Db, Stmt> ? Stmt : CheckSqlValid<Db, Stmt>): Promise<Array<...>>
 *
 *   // NEW method for validation
 *   validateQuery<Stmt extends string>(statement: Stmt): InferSqlErrors<Db, Stmt>
 *
 *   // Or as a type-level helper
 *   // type ValidateQuery<Db, Stmt> = InferSqlErrors<Db, Stmt>
 * }
 *
 * Usage:
 *
 * // Validate SQL without execution
 * type Error = typeof db.validateQuery<`select invalid from users`>
 * // Error = SqlParserError<"Unknown column"> | null
 *
 * // Or in tests
 * const error = db.validateQuery(`select invalid from users`)
 * if (error) {
 *   console.log("SQL invalid:", error)
 * }
 */

import { sqlMigrations } from "../core/sql-database.ts"
import type { InferSqlErrors } from "../../test/test-utils/parser-test-utils.ts"
import { mockDriver } from "../../test/test-utils/test-databases.ts"

async function testVariant2() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// Current approach (works)
	const good = await db.query(`select id, name from users;`)

	// NEW approach: validation without execution (hypothetical)
	// type ValidationResult = InferSqlErrors<typeof db, `select invalid from users`>
	// ValidationResult = SqlParserError<"Unknown column"> | null

	return { good }
}

export { testVariant2 }

/**
 * VARIANT 2: Explicit Validation
 *
 * Advantages:
 * ✅ SQL can be validated without execution
 * ✅ Clear API for validation
 * ✅ Useful for tests and tooling
 *
 * Disadvantages:
 * ❌ Additional method (larger API surface)
 * ❌ InferSqlErrors already exists as a type-level helper
 * ❌ No additional safety (query() already validates)
 *
 * Conclusions:
 * - InferSqlErrors<Db, Stmt> already allows type-level validation
 * - Runtime method .validateQuery() is unnecessary (there is no runtime validation)
 * - The current API is expressive enough
 */
