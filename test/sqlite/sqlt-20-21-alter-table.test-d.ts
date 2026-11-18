// SQLT-20, SQLT-21: SQLite ALTER TABLE forms and the ADD COLUMN rules.
import { sqlMigrations, type GetApplyError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const base = sqlMigrations({ driver: sqliteDriver }).apply(
	`create table t (id integer primary key, name text not null, old integer);`,
)

// SQLT-20: RENAME TO, RENAME COLUMN, ADD COLUMN, DROP COLUMN
const altered = base
	.apply(`alter table t rename column old to newer;`)
	.apply(`alter table t add column extra text default 'x';`)
	.apply(`alter table t add score real;`)
	.apply(`alter table t add column flag integer not null default 0;`)
	.apply(`alter table t drop column name;`)
	.apply(`alter table t rename to u;`)
	.database()
const _u = await altered.query(`select id, newer, extra, score, flag from u`)
expectType<typeof _u>(
	toBe<Array<{ id: number; newer: number | null; extra: string | null; score: number | null; flag: number }>>(),
)

// SQLT-20: PostgreSQL-only forms are compile errors naming it PostgreSQL-only (DSEL-5)
const alterType = `alter table t alter column old type text;` as const
// @ts-expect-error
base.apply(alterType)
expectType<GetApplyError<typeof base, typeof alterType>>(
	toBe<
		DbtyperError<
			1900,
			"ALTER COLUMN is PostgreSQL-only; this database is SQLite. Rebuild the table (create, copy, drop, rename)"
		>
	>(),
)
const setNotNull = `alter table t alter column old set not null;` as const
// @ts-expect-error
base.apply(setNotNull)
const addConstraint = `alter table t add constraint c unique (name);` as const
// @ts-expect-error
base.apply(addConstraint)
expectType<GetApplyError<typeof base, typeof addConstraint>>(
	toBe<
		DbtyperError<1900, "ADD CONSTRAINT is PostgreSQL-only; this database is SQLite. Declare it in CREATE TABLE">
	>(),
)

// SQLT-21: ADD COLUMN with PRIMARY KEY or UNIQUE, or NOT NULL without a default
const addPk = `alter table t add column k integer primary key;` as const
// @ts-expect-error
base.apply(addPk)
expectType<GetApplyError<typeof base, typeof addPk>>(
	toBe<DbtyperError<1914, "SQLite cannot ADD COLUMN with PRIMARY KEY">>(),
)
const addUnique = `alter table t add column k text unique;` as const
// @ts-expect-error
base.apply(addUnique)
expectType<GetApplyError<typeof base, typeof addUnique>>(
	toBe<DbtyperError<1914, "SQLite cannot ADD COLUMN with UNIQUE">>(),
)
const addNotNull = `alter table t add column k text not null;` as const
// @ts-expect-error
base.apply(addNotNull)
expectType<GetApplyError<typeof base, typeof addNotNull>>(
	toBe<DbtyperError<1914, "SQLite cannot ADD COLUMN with NOT NULL without a non-null DEFAULT">>(),
)
