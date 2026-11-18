// Integration Test: DML-13: SQLite RETURNING with columns and an aliased expression
import { createDriver, sqlMigrations } from "../../../src/core/sql-database.ts"
import type { SqliteDriverConfig } from "../../../src/sqlite/sqlite-type-map.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: createDriver<SqliteDriverConfig>({ query: async () => [] }) })
	.apply(
		`create table users (id integer primary key, name text not null, email text); create table posts (id integer primary key, user_id integer not null, title text, score real);`,
	)
	.database()

// ✅ SUCCESS: DML-13: SQLite RETURNING with columns and an aliased expression
const _result = await _db.query(`insert into users (id, name) values (1, 'A') returning id, email, upper(name) as n;`)

expectType<typeof _result>(toBe<{ id: number; email: string | null; n: string }[]>())
