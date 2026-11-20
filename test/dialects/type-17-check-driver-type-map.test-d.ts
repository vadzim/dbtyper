// Integration Test: TYPE-17 Check (verification/types.md @ 2a941c8): the driver's scalarTypes map decides the TypeScript types.
import { createDriver, sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { LexerFeatures } from "../../src/lexer/sql-lexer.ts"
import { postgresSqlDriver } from "../../src/postgres/index.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const schema = `create table t (id integer not null, name text not null);`
type Config<Map> = { dialect: "postgres"; scalarTypes: Map; syntax: LexerFeatures }

const numbers = createDriver<Config<{ integer: number; text: string }>>({ query: async () => [] })
const _a = await sqlMigrations({ driver: numbers }).apply(schema).database().query(`select id, name from t`)
expectType<typeof _a>(toBe<{ id: number; name: string }[]>())

const bigints = createDriver<Config<{ integer: bigint; text: string }>>({ query: async () => [] })
const _b = await sqlMigrations({ driver: bigints }).apply(schema).database().query(`select id, name from t`)
expectType<typeof _b>(toBe<{ id: bigint; name: string }[]>())

// ❌ ERROR: no `text` in the map: dbtyper:3506, never unknown (CORE-14)
const noText = createDriver<Config<{ integer: number }>>({ query: async () => [] })
const dbNoText = sqlMigrations({ driver: noText }).apply(schema).database()
const q = `select name from t` as const
// @ts-expect-error
await dbNoText.query(q)
type E = GetQueryError<typeof dbNoText, typeof q>
expectType<E extends DbtyperError<3506, string> ? true : false>(toBe<true>())

// postgresSqlDriver({ sql, bigint: true }) types int8 as bigint (PGT-4)
const pgBig = sqlMigrations({ driver: postgresSqlDriver({ sql: undefined as never, bigint: true }) })
	.apply(`create table t (id int8 not null);`)
	.database()
const _c = await pgBig.query(`select id from t`)
expectType<typeof _c>(toBe<{ id: bigint }[]>())
