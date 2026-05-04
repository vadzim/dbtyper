// Variant 4: Query builder with validation at every step
// Idea: db.select().from().where().execute() with validation

/**
 * VARIANT 4: Query Builder with Step-by-Step Validation
 *
 * Proposed changes in src/core/sql-database.ts:
 *
 * export type DataBase<Db> = {
 *   // Existing API
 *   query<Stmt>(statement: Stmt extends CheckSqlValid<Db, Stmt> ? Stmt : CheckSqlValid<Db, Stmt>): Promise<Array<...>>
 *
 *   // NEW builder API
 *   select<Cols extends string>(
 *     columns: Cols extends ValidColumns<Db> ? Cols : ValidColumns<Db>
 *   ): SelectBuilder<Db, Cols>
 * }
 *
 * type SelectBuilder<Db, Cols> = {
 *   from<Table extends string>(
 *     table: Table extends ValidTable<Db> ? Table : ValidTable<Db>
 *   ): FromBuilder<Db, Cols, Table>
 * }
 *
 * type FromBuilder<Db, Cols, Table> = {
 *   where<Cond extends string>(
 *     condition: Cond extends ValidCondition<Db, Table> ? Cond : ValidCondition<Db, Table>
 *   ): WhereBuilder<Db, Cols, Table, Cond>
 *
 *   execute(): Promise<Array<SelectResult<Db, Cols, Table>>>
 * }
 *
 * type WhereBuilder<Db, Cols, Table, Cond> = {
 *   execute(): Promise<Array<SelectResult<Db, Cols, Table>>>
 * }
 *
 * Usage:
 *
 * // Builder style
 * const rows = await db
 *   .select(`id, name`)
 *   .from(`users`)
 *   .where(`active = true`)
 *   .execute()
 *
 * // Validation at every step
 * const invalid = await db
 *   .select(`invalid_column`)  // ❌ Error: Unknown column
 *   .from(`users`)
 *   .execute()
 */

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testVariant4() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, active boolean);`)
		.database()

	// Current API (plain SQL)
	const current = await db.query(`select id, name from users;`)

	// Hypothetical builder API
	// const builder = await db
	//   .select(`id, name`)
	//   .from(`users`)
	//   .where(`active = true`)
	//   .execute()

	return { current }
}

export { testVariant4 }

/**
 * VARIANT 4: Query Builder with Validation
 *
 * Advantages:
 * ✅ Validation at every step
 * ✅ Better autocompletion
 * ✅ More structured code
 *
 * Disadvantages:
 * ❌ Very verbose
 * ❌ Simplicity of SQL is lost
 * ❌ Contradicts the "Write plain SQL" philosophy
 * ❌ LLMs understand SQL better than a builder DSL
 * ❌ Complex implementation (many types)
 * ❌ Not all SQL features can be expressed through a builder
 *
 * Conclusions:
 * - The builder pattern is not suitable for this library
 * - SQL is already an expressive query language
 * - The current API is simpler and more powerful
 * - LLMs can write SQL directly, without a builder DSL
 *
 * Comparison:
 *
 * Current API (1 line):
 *   await db.query(`select id, name from users where active = true`)
 *
 * Builder API (5 lines):
 *   await db
 *     .select(`id, name`)
 *     .from(`users`)
 *     .where(`active = true`)
 *     .execute()
 *
 * Result: The current API is clearer and more compact
 */
