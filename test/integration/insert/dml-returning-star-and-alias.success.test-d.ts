// Integration Test: RETURNING * beside another item (CORE-11)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

// ✅ SUCCESS
const _result = await db.query(`insert into users (id, name) values (1, 'a') returning *, id as id2;`)

expectType<typeof _result>(toBe<Array<{ id: number; name: string; id2: number }>>())
