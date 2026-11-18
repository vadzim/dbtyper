// DSEL-8: a custom driver declares its dialect; a driver without one is a compile error at sqlMigrations.
import { createDriver, sqlMigrations } from "../../src/core/sql-database.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

type NoDialectConfig = { scalarTypes: { integer: number }; syntax: "named-params" }
const noDialectDriver = createDriver<NoDialectConfig>({ query: async () => [] })

// DSEL-8: no dialect → error on `driver`
// @ts-expect-error
sqlMigrations({ driver: noDialectDriver })

type BothDialectsConfig = { dialect: "postgres" | "sqlite"; scalarTypes: { integer: number }; syntax: "named-params" }
const bothDialectsDriver = createDriver<BothDialectsConfig>({ query: async () => [] })

// DSEL-8: exactly one dialect
// @ts-expect-error
sqlMigrations({ driver: bothDialectsDriver })

type SqliteConfig = { dialect: "sqlite"; scalarTypes: { integer: number }; syntax: "named-params" }
const sqliteDriver = createDriver<SqliteConfig>({ query: async () => [] })

// DSEL-8: a declared dialect is accepted and decides the parsing
const db = sqlMigrations({ driver: sqliteDriver }).apply(`create table t (id integer not null);`).database()
const _rows = await db.query(`select id from t`)
expectType<typeof _rows>(toBe<Array<{ id: number }>>())
