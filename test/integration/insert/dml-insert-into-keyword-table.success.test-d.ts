// Integration Test: INSERT into a table named by a non-reserved keyword (#165)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table type (key integer not null, first text);`)
	.database()

// ✅ SUCCESS
const _result = await db.query(`insert into type (key) values (1) returning key;`)

expectType<typeof _result>(toBe<Array<{ key: number }>>())
