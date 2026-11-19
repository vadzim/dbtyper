// Spec tests: SCHEMA-3, SCHEMA-27, STMT-6, STMT-18, FN-4
import { sqlMigrations } from "../../src/core/sql-database.ts"
import { postgresSqlDriver } from "../../src/postgres/index.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type postgres from "postgres"

declare const client: ReturnType<typeof postgres>

// SCHEMA-3: a custom defaultSchema resolves unqualified names
const custom = sqlMigrations({ driver: mockDriver, defaultSchema: "app" })
	.apply(`create schema app;`)
	.apply(`create table t (id integer not null);`)
	.database()
const _s3 = await custom.query(`select id from t`)
expectType<typeof _s3>(toBe<{ id: number }[]>())
const _s3q = await custom.query(`select id from app.t`)
expectType<typeof _s3q>(toBe<{ id: number }[]>())

// SCHEMA-27: the schema public exists from the start; SCHEMA-28: creating it is an error (3200)
const bare = sqlMigrations({ driver: mockDriver }).apply(`create table t0 (id integer not null);`).database()
const _s27 = await bare.query(`select id from t0`)
expectType<typeof _s27>(toBe<{ id: number }[]>())
const ifNotExists = sqlMigrations({ driver: mockDriver })
	.apply(`create schema if not exists public; create table t (id integer not null);`)
	.database()
const _s28 = await ifNotExists.query(`select id from t`)
expectType<typeof _s28>(toBe<{ id: number }[]>())
// @ts-expect-error 3200 "Schema already exists; use IF NOT EXISTS": public is there already
const dupPublic = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`)
void dupPublic

// STMT-18: a skipped statement changes nothing and the next statements are processed
const skip = sqlMigrations({ driver: mockDriver })
	.apply(`set search_path = public; create table t (id integer not null);`)
	.database()
const _s12 = await skip.query(`select id from t`)
expectType<typeof _s12>(toBe<{ id: number }[]>())

// FN-4: function names are case-insensitive
const _f4 = await skip.query(`select COUNT(*) as a, count(*) as b from t`)
expectType<typeof _f4>(toBe<{ a: string; b: string }[]>())

// STMT-6: with the postgres driver a $$ body with `;` is one literal
const dollar = sqlMigrations({ driver: postgresSqlDriver({ sql: client }) })
	.apply(`create table t (id integer not null); select $$a;b$$ as s; create table u (x text not null);`)
	.database()
const _s6 = await dollar.query(`select x from u`)
expectType<typeof _s6>(toBe<{ x: string }[]>())
