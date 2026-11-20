// RUN-5: query of a select is Array<{ id: string; name: string }>
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id text not null, name text not null);`)
	.apply(`create schema auth;`)
	.apply(`create table auth.users (email text not null, display_name text);`)
	.database()

const _result = await db.query(`select id, name from users;`)
expectType<typeof _result>(toBe<Array<{ id: string; name: string }>>())
