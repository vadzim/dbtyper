// Integration Test: DML-4 NOT NULL column with a default may be omitted
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id text not null, name text not null, age numeric not null default 18);`)
	.database()

// ✅ SUCCESS: DML-4 NOT NULL column with a default may be omitted
const _result = await _db.query(`insert into users (id, name) values ('1', 'A');`)

expectType<typeof _result>(toBe<[]>())
