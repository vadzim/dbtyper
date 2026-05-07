import { it } from "node:test"
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

it("should reject qualified columns not in FROM even if table exists in database", () => {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table other_table (value text);`)
		.database()

	// Even though users table exists in database, we cannot reference users.id
	// because users is not in the FROM clause (only other_table is)
	const result = db.query(
		// @ts-expect-error
		`select users.id, users.name from other_table;`,
	)
})
