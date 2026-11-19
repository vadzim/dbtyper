// Integration Test: SEL-34 WHERE, GROUP BY, HAVING, ORDER BY and FETCH together
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

// ✅ SUCCESS: SEL-34 WHERE, GROUP BY, HAVING, ORDER BY and FETCH together
const _result = await _db.query(
	`select id from users where id = 1 group by id having count(*) > 1 order by id fetch next 1 row only;`,
)

expectType<typeof _result>(toBe<{ id: number }[]>())
