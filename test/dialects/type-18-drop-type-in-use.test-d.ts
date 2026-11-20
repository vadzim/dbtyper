// TYPE-18: DROP TYPE of an enum that a column uses is an error; CASCADE drops the columns
import { sqlMigrations, type GetApplyError } from "../../src/core/sql-database.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"

const base = sqlMigrations({ driver: mockDriver }).apply(
	`create type mood as enum ('a','b'); create table t (id integer not null, m mood); create table u (xs mood[]);`,
)

const inUse = `drop type mood;` as const
// @ts-expect-error
base.apply(inUse)
expectType<GetApplyError<typeof base, typeof inUse>>(
	toBe<DbtyperError<3212, "Type is used by a column; drop the column first or use CASCADE (TYPE-18)">>(),
)

// RESTRICT is the default
const restrict = `drop type mood restrict;` as const
// @ts-expect-error
base.apply(restrict)

// IF EXISTS does not hide it
const ifExists = `drop type if exists mood;` as const
// @ts-expect-error
base.apply(ifExists)

// CASCADE removes the columns
const cascaded = base.apply(`drop type mood cascade;`)
cascaded.apply(`select id from t;`)
// @ts-expect-error
cascaded.apply(`select m from t;`)
// @ts-expect-error
cascaded.apply(`select xs from u;`)

// dropping the column first, or a type nobody uses, is fine
base.apply(`alter table t drop column m; drop table u; drop type mood;`)
sqlMigrations({ driver: mockDriver }).apply(`create type mood as enum ('a'); drop type mood;`)
