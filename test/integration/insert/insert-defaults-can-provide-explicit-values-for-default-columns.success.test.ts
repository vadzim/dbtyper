// Integration Test: INSERT with defaults - can provide explicit values for DEFAULT columns
// Integration Test: INSERT with DEFAULT columns
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table users (
				id text not null,
				name text not null,
				age numeric not null default 18,
				active boolean not null default true,
				created_at timestamp default now()
			);`,
	)
	.database()
// ✅ SUCCESS: can provide explicit values for DEFAULT columns

const _result = await _db.query(`insert into users (id, name, age, active) values ('2', 'Bob', 25, false) returning *;`)

type _check = Expect<
	Matches<typeof _result, { name: string; id: string; active: boolean; created_at: Date; age: number }[]>
>
