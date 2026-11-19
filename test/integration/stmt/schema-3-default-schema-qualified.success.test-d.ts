// Integration Test: SCHEMA-3 a custom defaultSchema: a table created there is reachable qualified
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver, defaultSchema: "app" })
	.apply(`create schema app;`)
	.apply(`create table u (id int not null);`)

	.database()

const _result = await db.query(`select * from app.u;`)

expectType<typeof _result>(toBe<{ id: number }[]>())
