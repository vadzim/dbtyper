// Integration Test: TYPE-4 a parenthesised argument of timestamp/time/interval is stepped over
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table p (x timestamp(3) not null, y time(3) not null, z timestamp (3) with time zone not null);`)
	.database()

const _result = await db.query(`select x from p;`)
expectType<typeof _result>(toBe<{ x: Date }[]>())
