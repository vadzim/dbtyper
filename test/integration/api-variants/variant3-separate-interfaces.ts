// Variant 3: Separate typed/untyped interfaces
// Ідэя: Раздзяліць DataBase на TypedDataBase і UntypedDataBase

/**
 * VARIANT 3: Separate Typed/Untyped Interfaces
 *
 * Прапанаваныя змены ў src/core/sql-database.ts:
 *
 * // Толькі тыпізаваныя метады
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
 * // Толькі нетыпізаваныя метады
 * export type UntypedDataBase = {
 *   queryUntyped(statement: string, params?: Record<string, unknown>): Promise<Array<any>>
 *   streamUntyped(statement: string, params?: Record<string, unknown>): AsyncIterable<any>
 * }
 *
 * // Поўны інтэрфейс
 * export type DataBase<Db> = TypedDataBase<Db> & UntypedDataBase & {
 *   migrations: readonly MigrationExport[]
 *   defaultSchema: string
 * }
 *
 * Выкарыстанне:
 *
 * const db = sqlMigrations({ driver }).apply(...).database()
 *
 * // Тыпізаваны доступ
 * const typed: TypedDataBase<typeof db> = db
 * const rows = await typed.query(`select id from users`)
 *
 * // Нетыпізаваны доступ
 * const untyped: UntypedDataBase = db
 * const any = await untyped.queryUntyped(`select * from users`)
 */

import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testVariant3() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// Бягучы спосаб (усё разом)
	const good = await db.query(`select id, name from users;`)
	const untyped = await db.queryUntyped(`select * from users`)

	// Гіпатэтычны спосаб: раздзяленне
	// const typedDb: TypedDataBase<typeof db> = db
	// const untypedDb: UntypedDataBase = db

	return { good, untyped }
}

export { testVariant3 }

/**
 * VARIANT 3: Separate Typed/Untyped Interfaces
 *
 * Перавагі:
 * ✅ Больш выразная структура тыпаў
 * ✅ Можна абмежаваць доступ да untyped метадаў
 * ✅ Лепшая кампазіцыя тыпаў
 *
 * Недахопы:
 * ❌ Больш складаная структура
 * ❌ Не дае дадатковай бяспекі
 * ❌ Карыстальнік усё роўна мае доступ да ўсіх метадаў
 * ❌ Ускладняе API без выгоды
 *
 * Высновы:
 * - Раздзяленне тыпаў не дае практычнай выгоды
 * - Бягучы DataBase<Db> ужо дастаткова выразны
 * - queryUntyped() — гэта escape hatch, не асноўны API
 * - Не варта ўскладняць структуру
 */
