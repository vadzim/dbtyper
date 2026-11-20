// RUN-16: stream rows are { email: string } (the row count, at most 5, is checked at runtime against PostgreSQL)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id text not null, name text not null);`)
	.apply(`create schema auth;`)
	.apply(`create table auth.users (email text not null, display_name text);`)
	.database()

const _result = await Array.fromAsync(await db.stream(`select email from auth.users limit 5;`))
expectType<typeof _result>(toBe<Array<{ email: string }>>())
