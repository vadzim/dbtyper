// Integration Test: CORE-15 Check: create table a with constraint names, references, default and check applies; a.id non-null
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table b (id integer primary key);`)
	.apply(
		`create table a (id integer constraint a_pk primary key, b_id integer not null references b(id) on delete cascade, n text default 'x' check (n <> ''));`,
	)
	.database()

// ✅ SUCCESS: CORE-15
const _result = await _db.query(`select id from a`)

expectType<typeof _result>(toBe<{ id: number }[]>())
