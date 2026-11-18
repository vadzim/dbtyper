// Integration Test: CORE-16 a DEFAULT that fits its column is accepted, any expression, any position
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table t (
			n text default 'x',
			age integer default 18 not null,
			price numeric default 1.5,
			neg integer default -1,
			active boolean default true,
			made timestamp default current_timestamp,
			made2 timestamptz default now(),
			id uuid default gen_random_uuid(),
			nothing text default null,
			seq integer default nextval('t_seq')
		);`,
	)
	.database()

// ✅ SUCCESS: CORE-16 applied
const _rows = await _db.query(`select age from t;`)

expectType<typeof _rows>(toBe<{ age: number }[]>())
