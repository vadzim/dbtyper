// Integration Test: CORE-13, DML-9: SQLite UPDATE without RETURNING is an empty row list
import { createDriver, sqlMigrations } from "../../../src/core/sql-database.ts"
import type { SqliteDriverConfig } from "../../../src/sqlite/sqlite-type-map.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: createDriver<SqliteDriverConfig>({ query: async () => [] }) })
	.apply(
		`create table users (id integer primary key, name text not null, email text); create table posts (id integer primary key, user_id integer not null, title text, score real);`,
	)
	.database()

// ✅ SUCCESS: CORE-13, DML-9: SQLite UPDATE without RETURNING is an empty row list
const _result = await _db.query(`update users set name = 'Bob' where id = 1;`)

expectType<typeof _result>(toBe<[]>())
