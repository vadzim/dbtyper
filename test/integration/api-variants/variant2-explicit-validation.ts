// Variant 2: API з explicit validation method
// Ідэя: Дадаць .validateQuery() для праверкі SQL без выканання

/**
 * VARIANT 2: Explicit Validation
 *
 * Прапанаваныя змены ў src/core/sql-database.ts:
 *
 * export type DataBase<Db> = {
 *   // Існуючыя метады
 *   query<Stmt>(statement: Stmt extends CheckSqlValid<Db, Stmt> ? Stmt : CheckSqlValid<Db, Stmt>): Promise<Array<...>>
 *
 *   // НОВЫ метад для валідацыі
 *   validateQuery<Stmt extends string>(statement: Stmt): InferSqlErrors<Db, Stmt>
 *
 *   // Альбо як тыпавы helper
 *   // type ValidateQuery<Db, Stmt> = InferSqlErrors<Db, Stmt>
 * }
 *
 * Выкарыстанне:
 *
 * // Праверка SQL без выканання
 * type Error = typeof db.validateQuery<`select invalid from users`>
 * // Error = SqlParserError<"Unknown column"> | null
 *
 * // Або ў тэстах
 * const error = db.validateQuery(`select invalid from users`)
 * if (error) {
 *   console.log("SQL invalid:", error)
 * }
 */

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { InferSqlErrors } from "../../../src/core/sql-query.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testVariant2() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// Бягучы спосаб (працуе)
	const good = await db.query(`select id, name from users;`)

	// НОВЫ спосаб: праверка без выканання (гіпатэтычны)
	// type ValidationResult = InferSqlErrors<typeof db, `select invalid from users`>
	// ValidationResult = SqlParserError<"Unknown column"> | null

	return { good }
}

export { testVariant2 }

/**
 * VARIANT 2: Explicit Validation
 *
 * Перавагі:
 * ✅ Можна праверыць SQL без выканання
 * ✅ Выразны API для валідацыі
 * ✅ Карысна для тэстаў і tooling
 *
 * Недахопы:
 * ❌ Дадатковы метад (больш API surface)
 * ❌ InferSqlErrors ужо існуе як тыпавы helper
 * ❌ Не дае дадатковай бяспекі (query() ужо валідуе)
 *
 * Высновы:
 * - InferSqlErrors<Db, Stmt> ужо дазваляе праверку на ўзроўні тыпаў
 * - Runtime метад .validateQuery() не трэба (няма runtime валідацыі)
 * - Бягучы API дастаткова выразны
 */
