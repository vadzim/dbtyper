// Variant 1: Бягучы API (baseline)
// Гэта дакладная копія бягучага API для параўнання

import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testVariant1() {
	const db = await sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ Правільны запыт
	const good = await db.query(`select id, name from users;`)

	// ❌ Няправільны запыт — павінна даваць памылку
	// const bad = await db.query(`select invalid_column from users;`)
	// error TS2345: Argument of type '"select invalid_column from users;"'
	// is not assignable to parameter of type '"Unknown column"'.

	return { good }
}

export { testVariant1 }

/**
 * VARIANT 1: Бягучы API
 *
 * Структура:
 * - sqlMigrations({ driver }).apply(...).database()
 * - db.query(sql) → Promise<Array<Row>>
 * - db.stream(sql) → AsyncIterable<Row>
 * - db.queryUntyped(sql) → Promise<Array<any>>
 *
 * Валідацыя:
 * - CheckSqlValid<Db, Stmt> у parameter constraint
 * - Памылкі паказваюцца як TS2345
 *
 * Перавагі:
 * ✅ Просты і інтуітыўны
 * ✅ Валідацыя працуе
 * ✅ Адпавядае філасофіі "plain SQL"
 *
 * Недахопы:
 * ❌ Error messages могуць быць больш выразнымі
 * ❌ Няма спосабу праверыць SQL без выканання
 */
