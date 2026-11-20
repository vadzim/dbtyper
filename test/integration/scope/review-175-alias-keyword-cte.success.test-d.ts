// Integration Test: a bare CTE alias that is a non-reserved keyword (#175 "one alias parser": the copies took TokenIdent for a bare alias, AsIdent elsewhere, #165)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table users (id integer not null);`).database()

// ✅ SUCCESS
const _result = await db.query(`with c as (select id from users) select type.id from c type;`)

expectType<typeof _result>(toBe<Array<{ id: number }>>())
