// Integration Test: DSEL-11 Check: shared SQL has the same types in both dialects; create schema is 1900 on SQLite
import { sqlMigrations, type GetApplyError } from "../../src/core/sql-database.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"

const lite = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table users (id integer not null, name text);`)
	.database()
const pg = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text);`)
	.database()

const q = "select id, coalesce(name, 'x') as n, case when id > 1 then name end as c from users order by id limit 5"

// ✅ SUCCESS: DSEL-11
const _liteRows = await lite.query(q)
const _pgRows = await pg.query(q)
expectType<typeof _liteRows>(toBe<Array<{ id: number; n: string; c: string | null }>>())
expectType<typeof _pgRows>(toBe<Array<{ id: number; n: string; c: string | null }>>())

// ✅ SUCCESS: DSEL-11 the same create table gives the same NOT NULL columns
const ddl = "create table t (a integer primary key, b text not null, c text)"
const liteT = sqlMigrations({ driver: sqliteDriver }).apply(ddl).database()
const pgT = sqlMigrations({ driver: mockDriver }).apply(ddl).database()
const _liteT = await liteT.query("select a, b, c from t")
const _pgT = await pgT.query("select a, b, c from t")
expectType<typeof _liteT>(toBe<Array<{ a: number; b: string; c: string | null }>>())
expectType<typeof _pgT>(toBe<Array<{ a: number; b: string; c: string | null }>>())

// ✅ SUCCESS: DSEL-11 PostgreSQL applies create schema
sqlMigrations({ driver: mockDriver }).apply("create schema auth")

// ❌ ERROR: DSEL-11 SQLite: create schema is 1900
const liteMig = sqlMigrations({ driver: sqliteDriver })
const schema = "create schema auth" as const
// @ts-expect-error
liteMig.apply(schema)
type SchemaError = GetApplyError<typeof liteMig, typeof schema>
expectType<SchemaError extends DbtyperError<1900, string> ? true : false>(toBe<true>())
