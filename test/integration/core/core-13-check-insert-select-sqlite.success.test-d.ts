// Integration Test: CORE-13 Check: insert select is [] (sqlite)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { sqliteDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: sqliteDriver })
	.apply(
		`create table users (id integer not null, name text not null, email text); create table posts (id integer not null, user_id integer not null, title text);`,
	)
	.database()

// ✅ SUCCESS: CORE-13
const _result = await _db.query(`insert into users (name) select title from posts`)

expectType<typeof _result>(toBe<[]>())
