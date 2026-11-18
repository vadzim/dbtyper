// Integration Test: SELECT - CORE-12 WITH RECURSIVE: column types from the non-recursive part
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text);`)
	.apply(`create table posts (id integer not null, user_id integer not null, title text not null, score bigint);`)
	.database()

// ✅ SUCCESS: CORE-12
const _result = await _db.query(
	`with recursive t (n) as (select 1 as n union all select n + 1 as n from t where n < 10) select n from t;`,
)

expectType<typeof _result>(toBe<{ n: number }[]>())
