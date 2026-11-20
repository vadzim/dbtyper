// Integration Test: INSERT … SELECT needs no AS aliases (#166)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table users (id integer not null, name text not null); create table posts (id integer not null, body text not null);`,
	)
	.database()

// ✅ SUCCESS
const _result = await db.query(`insert into users (id, name) select id, 'x' from posts;`)

expectType<typeof _result>(toBe<[]>())
