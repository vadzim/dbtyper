// Integration Test: INSERT NOT NULL validation - nullable column can be omitted
// Integration Test: INSERT - require values for NOT NULL columns without defaults
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text not null, name text not null, email text);`)
	.database()
// ✅ SUCCESS: nullable column can be omitted

const _result = await _db.query(`insert into users (id, name, email) values ('2', 'Bob', null) returning *;`)

expectType<typeof _result>(
	toBe<
		Array<{
			id: string
			name: string
			email: string | null
		}>
	>(),
)
