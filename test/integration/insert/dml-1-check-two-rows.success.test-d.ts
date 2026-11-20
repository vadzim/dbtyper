// Integration Test: DML-1 Check: a two-row insert is []
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table users (id text not null, name text not null, email text); create table users_backup (id text not null, name text not null);`,
	)
	.database()

// ✅ SUCCESS: DML-1
const _result = await _db.query(`insert into users (id, name) values ('1', 'Alice'), ('2', 'Bob');`)

expectType<typeof _result>(toBe<[]>())
