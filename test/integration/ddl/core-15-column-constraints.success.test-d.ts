// Integration Test: CORE-15 column constraints in any order, named or not; CORE-1 PRIMARY KEY makes a column NOT NULL
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table b (id integer primary key);`)
	.apply(
		`create table a (
			id integer constraint a_pk primary key,
			b_id integer not null references b(id) on delete cascade on update set null,
			c_id integer references public.b match full,
			n text default 'x' check (n <> '') unique,
			m text collate "C" not null default 'y' constraint m_len check (length(m) > 0),
			k integer default 0 not null,
			g integer generated always as (k * 2) stored
		);`,
	)
	.database()

// ✅ SUCCESS: CORE-15 / CORE-1 / CORE-18 constraints in any order; PRIMARY KEY and NOT NULL give non-null columns
const _result = await _db.query(`select * from a;`)

expectType<typeof _result>(
	toBe<
		{
			id: number
			b_id: number
			c_id: number | null
			n: string | null
			m: string
			k: number
			g: number | null
		}[]
	>(),
)
