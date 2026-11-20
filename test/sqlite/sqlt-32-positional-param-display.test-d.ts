// #177: messages name a positional parameter the way the dialect spells it: `?1` in a SQLite chain, `$1` in PostgreSQL;
// named parameters stay `:name`. One helper (ParamDisplay) builds the name for CORE-7 (2405) and CORE-6 (2509).
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver, sqliteMockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const _sqlite = sqlMigrations({ driver: sqliteMockDriver })
	.apply(`create table t (id integer not null, name text not null);`)
	.database()
const _pg = sqlMigrations({ driver: mockDriver })
	.apply(`create table t (id integer not null, name text not null);`)
	.database()

// CORE-7: no position gives the type (a probe left over that the SQL reads)
const _read = `select ? * ? as result;` as const
expectType<GetQueryError<typeof _sqlite, typeof _read, [number, number]>>(
	toBe<DbtyperError<2405, "cannot infer the type of parameter ?1; use CAST(?1 AS …)">>(),
)
expectType<GetQueryError<typeof _pg, typeof _read, [number, number]>>(
	toBe<DbtyperError<2405, "cannot infer the type of parameter $1; use CAST($1 AS …)">>(),
)
// the second one is named by its own number
const _second = `select id from t where id = ? and ? is null;` as const
expectType<GetQueryError<typeof _sqlite, typeof _second, [number, number]>>(
	toBe<DbtyperError<2405, "cannot infer the type of parameter ?2; use CAST(?2 AS …)">>(),
)
// numbered `?3` is the third one
const _numbered = `select id from t where id = ?1 and name = ?2 and ?3 is null;` as const
expectType<GetQueryError<typeof _sqlite, typeof _numbered, [number, string, number]>>(
	toBe<DbtyperError<2405, "cannot infer the type of parameter ?3; use CAST(?3 AS …)">>(),
)

// CORE-6: a value of another type than the SQL gives the parameter
const _wrong = `select name from t where id = ?;` as const
expectType<GetQueryError<typeof _sqlite, typeof _wrong, [string]>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter ?1">>(),
)
expectType<GetQueryError<typeof _pg, typeof _wrong, [string]>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter $1">>(),
)

// named parameters keep `:name` in both
const _named = `select name from t where id = :id;` as const
expectType<GetQueryError<typeof _sqlite, typeof _named, { id: string }>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter :id">>(),
)
