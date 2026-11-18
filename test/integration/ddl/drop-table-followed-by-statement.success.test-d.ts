// Integration Test: SCHEMA-20 a DROP TABLE may be followed by further statements
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table t (id int not null); drop table t; select 1 as x;`)
	.database()

const query = `select 1 as x;` as const
const _ok = db.query(query)
