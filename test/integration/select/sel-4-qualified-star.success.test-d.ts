// Integration Test: SEL-4 qualified star beside another column
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null);`)
	.apply(`create table orders (id integer not null, user_id integer not null, total integer not null);`)
	.database()

// ✅ SUCCESS: SEL-4 qualified star beside another column
const _result = await _db.query(`select u.*, orders.total from users u join orders on u.id = orders.user_id;`)

expectType<typeof _result>(toBe<{ id: number; name: string; total: number }[]>())
