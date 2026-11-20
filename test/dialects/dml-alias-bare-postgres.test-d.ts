// DML-ALIAS: PostgreSQL accepts the alias of an UPDATE / DELETE target with or without AS
import { sqlMigrations } from "../../src/core/sql-database.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

const _updated = await db.query(`update users u set name = 'b' where u.id = 1 returning u.name`)
expectType<typeof _updated>(toBe<{ name: string }[]>())

const _deleted = await db.query(`delete from users u where u.id = 1 returning u.id`)
expectType<typeof _deleted>(toBe<{ id: number }[]>())
