// RUN-14: createDriver<PostgresDriver> types timestamp columns as Date and bigint columns as string (PGT-3).
import { createDriver, sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresDriver } from "../../../src/postgres/index.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: createDriver<PostgresDriver>({ query: async () => [] }) })
	.apply(`create schema public;`)
	.apply(`create table t (at timestamp not null, big bigint not null);`)
	.database()

const _result = await db.query(`select at, big from t;`)

expectType<typeof _result>(toBe<Array<{ at: Date; big: string }>>())
