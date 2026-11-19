// CORE-6: INSERT without a column list gives parameters the types of the columns in declaration order
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

const _result = await _db.query(`insert into users values (:i, :n) returning id;`, { i: 1, n: "x" })
expectType<typeof _result>(toBe<Array<{ id: number }>>())
