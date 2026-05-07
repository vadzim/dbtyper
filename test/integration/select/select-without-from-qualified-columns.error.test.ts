import { it } from "node:test"
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

it("should reject qualified column references without FROM even if table exists", () => {
	const _db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// Even though users table exists, we cannot reference users.id without FROM
	const _result = _db.query(
		// @ts-expect-error
		`select users.id, users.name;`,
	)
})
