// Integration Test: DML-12 USING table in scope for RETURNING
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text not null);`)
	.apply(`create table banned (user_id text not null);`)
	.database()

// ✅ SUCCESS: DML-12 USING table in scope for RETURNING
const _result = await _db.query(
	`delete from users using banned where banned.user_id = users.id returning banned.user_id;`,
)

expectType<typeof _result>(toBe<{ user_id: string }[]>())
