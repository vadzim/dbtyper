// Variant 3: Separate typed/untyped interfaces
// Idea: Split DataBase into TypedDataBase and UntypedDataBase

/**
 * VARIANT 3: Separate Typed/Untyped Interfaces
 *
 * Proposed changes in src/core/sql-database.ts:
 *
 * // Typed methods only
 * export type TypedDataBase<Db> = {
 *   query<Stmt extends string>(
 *     statement: Stmt extends CheckSqlValid<Db, Stmt> ? Stmt : CheckSqlValid<Db, Stmt>
 *   ): Promise<Array<SqlSelectRowObject<Db, Stmt>>>
 *
 *   stream<Stmt extends string>(
 *     statement: Stmt extends CheckSqlValid<Db, Stmt> ? Stmt : CheckSqlValid<Db, Stmt>
 *   ): AsyncIterable<SqlSelectRowObject<Db, Stmt>>
 * }
 *
 * // Untyped methods only
 * export type UntypedDataBase = {
 *   queryUntyped(statement: string, params?: Record<string, unknown>): Promise<Array<any>>
 *   streamUntyped(statement: string, params?: Record<string, unknown>): AsyncIterable<any>
 * }
 *
 * // Full interface
 * export type DataBase<Db> = TypedDataBase<Db> & UntypedDataBase & {
 *   migrations: readonly MigrationExport[]
 *   defaultSchema: string
 * }
 *
 * Usage:
 *
 * const db = sqlMigrations({ driver }).apply(...).database()
 *
 * // Typed access
 * const typed: TypedDataBase<typeof db> = db
 * const rows = await typed.query(`select id from users`)
 *
 * // Untyped access
 * const untyped: UntypedDataBase = db
 * const any = await untyped.queryUntyped(`select * from users`)
 */

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testVariant3() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// Current approach (all together)
	const good = await db.query(`select id, name from users;`)
	const untyped = await db.queryUntyped(`select * from users`)

	// Hypothetical approach: separation
	// const typedDb: TypedDataBase<typeof db> = db
	// const untypedDb: UntypedDataBase = db

	return { good, untyped }
}

export { testVariant3 }

/**
 * VARIANT 3: Separate Typed/Untyped Interfaces
 *
 * Advantages:
 * ✅ Clearer type structure
 * ✅ Can restrict access to untyped methods
 * ✅ Better type composition
 *
 * Disadvantages:
 * ❌ More complex structure
 * ❌ No additional safety
 * ❌ Users still have access to all methods
 * ❌ Complicates the API without practical gain
 *
 * Conclusions:
 * - Splitting the types gives no practical benefit
 * - The current DataBase<Db> is already expressive enough
 * - queryUntyped() is an escape hatch, not the primary API
 * - The structure should not be made more complex
 */
