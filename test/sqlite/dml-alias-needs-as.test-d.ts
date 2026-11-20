// DML-ALIAS: on SQLite the alias of an UPDATE / DELETE target needs AS (error 1309); `AS alias` works
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteMockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: sqliteMockDriver })
	.apply(`create table users (id integer primary key, name text not null);`)
	.database()

const updateQuery = `update users u set name = 'b' where u.id = 1` as const
// @ts-expect-error
await db.query(updateQuery)
expectType<GetQueryError<typeof db, typeof updateQuery>>(
	toBe<DbtyperError<1309, "On SQLite the alias of the target table of UPDATE needs AS: write AS u">>(),
)

const deleteQuery = `delete from users u where u.id = 1` as const
// @ts-expect-error
await db.query(deleteQuery)
expectType<GetQueryError<typeof db, typeof deleteQuery>>(
	toBe<DbtyperError<1309, "On SQLite the alias of the target table of DELETE needs AS: write AS u">>(),
)

const _updated = await db.query(`update users as u set name = 'b' where u.id = 1 returning u.name`)
expectType<typeof _updated>(toBe<{ name: string }[]>())

const _deleted = await db.query(`delete from users as u where u.id = 1 returning u.id`)
expectType<typeof _deleted>(toBe<{ id: number }[]>())
