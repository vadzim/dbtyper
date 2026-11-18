// Integration Test: CORE-15 table constraints, named or not; CORE-1 a table-level PRIMARY KEY makes its columns NOT NULL
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table b (x integer, y integer, primary key (x, y));`)
	.apply(
		`create table a (
			id integer,
			x integer,
			y integer,
			note text,
			constraint a_pk primary key (id),
			unique (x, y),
			constraint a_chk check (id > 0 and (x is null or x > 0)),
			foreign key (x, y) references b (x, y) on delete restrict,
			constraint a_fk foreign key (x) references a (id)
		);`,
	)
	.database()

// ✅ SUCCESS: CORE-15 / CORE-1 only the primary key column is non-null
const _rows = await _db.query(`select * from a;`)

expectType<typeof _rows>(toBe<{ id: number; x: number | null; y: number | null; note: string | null }[]>())

// ✅ SUCCESS: CORE-1 a composite table-level key makes every listed column non-null
const _keys = await _db.query(`select * from b;`)

expectType<typeof _keys>(toBe<{ x: number; y: number }[]>())
