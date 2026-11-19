// Integration Test: FN-10 _result types of now(), gen_random_uuid(), uuid_generate_v4()
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table t (id int not null);`).database()

const _result = await db.query(`select now() as a, gen_random_uuid() as b, uuid_generate_v4() as c from t`)

expectType<typeof _result>(toBe<{ a: Date; b: string; c: string }[]>())
