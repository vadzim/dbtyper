// Integration Test: CORE-12 Check: recursive CTE counter
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table users (id integer not null, name text not null, email text); create table posts (id integer not null, user_id integer not null, title text);`,
	)
	.database()

// ✅ SUCCESS: CORE-12
const _result = await _db.query(
	`with recursive t (n) as (select 1 as n union all select n + 1 as n from t where n < 10) select n from t`,
)

expectType<typeof _result>(toBe<{ n: number }[]>())
