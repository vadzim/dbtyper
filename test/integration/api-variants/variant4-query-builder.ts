// Variant 4: Query builder з валідацыяй на кожным кроку
// Ідэя: db.select().from().where().execute() з валідацыяй

/**
 * VARIANT 4: Query Builder with Step-by-Step Validation
 *
 * Прапанаваныя змены ў src/core/sql-database.ts:
 *
 * export type DataBase<Db> = {
 *   // Існуючы API
 *   query<Stmt>(statement: Stmt extends CheckSqlValid<Db, Stmt> ? Stmt : CheckSqlValid<Db, Stmt>): Promise<Array<...>>
 *
 *   // НОВЫ builder API
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
 * Выкарыстанне:
 *
 * // Builder style
 * const rows = await db
 *   .select(`id, name`)
 *   .from(`users`)
 *   .where(`active = true`)
 *   .execute()
 *
 * // Валідацыя на кожным кроку
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

	// Бягучы API (просты SQL)
	const current = await db.query(`select id, name from users;`)

	// Гіпатэтычны builder API
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
 * Перавагі:
 * ✅ Валідацыя на кожным кроку
 * ✅ Лепшая аўтакамплітацыя
 * ✅ Больш структураваны код
 *
 * Недахопы:
 * ❌ Вельмі многаслоўна
 * ❌ Губляецца простата SQL
 * ❌ Супярэчыць філасофіі "Write plain SQL"
 * ❌ LLM лепш ведаюць SQL, чым builder DSL
 * ❌ Складаная рэалізацыя (шмат тыпаў)
 * ❌ Не ўсе SQL features можна выразіць праз builder
 *
 * Высновы:
 * - Builder pattern не падыходзіць для гэтай бібліятэкі
 * - SQL ужо ёсць выразная мова запытаў
 * - Бягучы API прасцей і магутней
 * - LLM могуць пісаць SQL адразу, без builder DSL
 *
 * Параўнанне:
 *
 * Бягучы API (1 радок):
 *   await db.query(`select id, name from users where active = true`)
 *
 * Builder API (5 радкоў):
 *   await db
 *     .select(`id, name`)
 *     .from(`users`)
 *     .where(`active = true`)
 *     .execute()
 *
 * Вынік: Бягучы API выразней і кампактней
 */
