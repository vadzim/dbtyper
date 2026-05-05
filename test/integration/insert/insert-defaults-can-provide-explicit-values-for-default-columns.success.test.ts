// Integration Test: INSERT with defaults - can provide explicit values for DEFAULT columns
// Integration Test: INSERT with DEFAULT columns
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Extends, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

const db = sqlMigrations({ driver: mockDriver })
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
const result = await db.query(`insert into users (id, name, age, active) values ('2', 'Bob', 25, false) returning *;`)
type _check = Expect<Extends<typeof result, unknown[]>>
