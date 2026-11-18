// Integration Test: CORE-19 CREATE TABLE ... AS SELECT: the SELECT's output columns, all nullable
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer primary key, name text not null, email text);`)
	.apply(`create table if not exists names as select id, name, email as mail from users;`)
	.database()

// ✅ SUCCESS: CORE-19 every column is nullable, names come from the SELECT
const _rows = await _db.query(`select * from names;`)

expectType<typeof _rows>(toBe<{ id: number | null; name: string | null; mail: string | null }[]>())
