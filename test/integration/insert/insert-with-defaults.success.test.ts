// Integration Test: INSERT with DEFAULT columns
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testInsertWithDefaults() {
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

	// ✅ SUCCESS: NOT NULL columns with DEFAULT can be omitted
	const result1 = await db.query(`insert into users (id, name) values ('1', 'Alice') returning *;`)

	// ✅ SUCCESS: can provide explicit values for DEFAULT columns
	const result2 = await db.query(
		`insert into users (id, name, age, active) values ('2', 'Bob', 25, false) returning *;`,
	)

	// ✅ SUCCESS: can mix omitted and provided DEFAULT columns
	const result3 = await db.query(`insert into users (id, name, age) values ('3', 'Charlie', 30) returning *;`)

	// ❌ ERROR: still must provide NOT NULL columns without DEFAULT
	const bad = await db.query(
		// @ts-expect-error
		`insert into users (age) values (20) returning *;`,
	)

	return { result1, result2, result3, bad }
}

testInsertWithDefaults()
