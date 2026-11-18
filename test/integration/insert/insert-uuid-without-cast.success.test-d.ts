// DML-16, PGT-16: a string literal into a uuid column needs no cast (PostgreSQL coerces the untyped literal)
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create schema auth;`)
	.apply(`create table auth.users (id uuid not null, email text not null, display_name text, login_count integer);`)
	.database()

const _result = await db.query(
	`insert into auth.users (id, email, display_name, login_count) values ('11111111-1111-1111-1111-111111111111', 'alice@example.com', 'Alice', 0);`,
)

expectType<typeof _result>(toBe<[]>())
