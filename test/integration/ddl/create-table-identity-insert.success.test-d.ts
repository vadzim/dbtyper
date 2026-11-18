// PGT-6: identity columns are NOT NULL and optional in INSERT (serial: create-table-serial-insert.success.test-d.skip.ts)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (g integer generated always as identity, name text not null);`)
	.database()

const _result = await _db.query(`insert into users (name) values ('a') returning g`)

expectType<typeof _result>(toBe<{ g: number }[]>())
