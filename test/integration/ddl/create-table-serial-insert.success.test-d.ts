// PGT-6: a serial/smallserial/bigserial column is NOT NULL and optional in INSERT.
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id bigserial primary key, n smallserial, s serial, name text not null);`)
	.database()

const _result = await _db.query(`insert into users (name) values ('a') returning id, n, s`)

expectType<typeof _result>(toBe<{ id: string; n: number; s: number }[]>())
