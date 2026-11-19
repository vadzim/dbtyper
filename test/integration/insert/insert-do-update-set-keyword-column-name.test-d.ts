// Integration Test: ON CONFLICT DO UPDATE SET accepts a column named like a non-reserved keyword, as UPDATE SET does
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table t (id integer primary key, begin integer);`)
	.database()

await db.query(`insert into t (id, begin) values (1, 2) on conflict (id) do update set begin = 3;`)
await db.query(`update t set begin = 3 where id = 1;`)
