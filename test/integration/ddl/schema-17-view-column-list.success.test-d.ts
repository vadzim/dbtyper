// Integration Test: SCHEMA-17 CREATE VIEW v (a, b) AS … renames the output columns in PostgreSQL too
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table t (id int not null, title text not null);`)
	.apply(`create view v (a, b) as select id, title from t;`)
	.database()

// ✅ SUCCESS: SCHEMA-17 the names rename the columns in order
const _result = await db.query(`select a, b from v;`)

expectType<typeof _result>(toBe<{ a: number; b: string }[]>())
