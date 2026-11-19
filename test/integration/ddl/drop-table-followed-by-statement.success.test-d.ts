// Integration Test: SCHEMA-20 a DROP TABLE may be followed by further statements
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table t (id int not null); drop table t; select 1 as x;`)
	.database()

const _result = await db.query(`select 1 as x;`)
expectType<typeof _result>(toBe<{ x: number }[]>())
