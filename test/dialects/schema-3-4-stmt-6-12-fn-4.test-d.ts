// Spec tests: SCHEMA-3, SCHEMA-4, STMT-6, STMT-12, FN-4
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

// SCHEMA-4: without `create schema public` the default schema is unknown (2214)
// @ts-expect-error 2214 "Unknown schema public for CREATE TABLE": the migration names a schema that was never created
const bare = sqlMigrations({ driver: mockDriver }).apply(`create table t (id integer not null);`)
void bare

// STMT-12: a skipped statement changes nothing and the next statements are processed
const skip = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public; set search_path = public; create table t (id integer not null);`)
	.database()
const _s12 = await skip.query(`select id from t`)
expectType<typeof _s12>(toBe<{ id: number }[]>())

// FN-4: function names are case-insensitive
const _f4 = await skip.query(`select COUNT(*) as a, count(*) as b from t`)
expectType<typeof _f4>(toBe<{ a: string; b: string }[]>())

// STMT-6: with the postgres driver a $$ body with `;` is one literal
const dollar = sqlMigrations({ driver: postgresSqlDriver({ sql: client }) })
	.apply(
		`create schema public; create table t (id integer not null); select $$a;b$$ as s; create table u (x text not null);`,
	)
	.database()
const _s6 = await dollar.query(`select x from u`)
expectType<typeof _s6>(toBe<{ x: string }[]>())
