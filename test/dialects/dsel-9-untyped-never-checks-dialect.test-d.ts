// DSEL-9: queryUntyped and streamUntyped exist in both dialects and never check dialect syntax.
import { sqlMigrations } from "../../src/core/sql-database.ts"
import { mockDriver, sqliteMockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const lite = sqlMigrations({ driver: sqliteMockDriver }).database()
const pg = sqlMigrations({ driver: mockDriver }).database()

const _liteRows = await lite.queryUntyped(`select id::text from users`)
const _liteStream = await lite.streamUntyped(`select $$x$$`)
const _pgRows = await pg.queryUntyped(`insert or replace into users (id) values (1)`)
const _pgStream = await pg.streamUntyped("select `name` from users")

expectType<typeof _liteRows>(toBe<Array<unknown>>())
expectType<typeof _liteStream>(toBe<AsyncIterable<unknown>>())
expectType<typeof _pgRows>(toBe<Array<unknown>>())
expectType<typeof _pgStream>(toBe<AsyncIterable<unknown>>())
