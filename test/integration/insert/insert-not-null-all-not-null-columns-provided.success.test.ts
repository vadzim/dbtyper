// Integration Test: INSERT NOT NULL validation - all NOT NULL columns provided
// Integration Test: INSERT - require values for NOT NULL columns without defaults
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text not null, name text not null, email text);`)
	.database()
// ✅ SUCCESS: all NOT NULL columns provided

const _result = await _db.query(`insert into users (id, name) values ('1', 'Alice') returning *;`)

type _check = Expect<
	Matches<
		typeof _result,
		Array<{
			id: string
			name: string
			email: string
		}>
	>
>
