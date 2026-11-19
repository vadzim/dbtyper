// Integration Test: INSERT - CORE-20 ON CONFLICT DO NOTHING without a target, RETURNING the inserted rows
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text);`)
	.database()

// ✅ SUCCESS: CORE-20
const _result = await _db.query(
	`insert into users (id, name) values (1, 'a') on conflict do nothing returning id, name;`,
)

expectType<typeof _result>(toBe<{ id: number; name: string | null }[]>())
