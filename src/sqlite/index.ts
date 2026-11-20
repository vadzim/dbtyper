import type { SqlDriver } from "../core/sql-database.ts"
import type { SqliteDriverConfig } from "./sqlite-type-map.ts"

/** What {@link betterSqlite3Driver} / {@link nodeSqliteDriver} return: a `SqlDriver` of the SQLite config (RUN-20; `Bigint` = big-integer mode, SQLT-4). */
export type SqliteSqlDriver<Bigint extends boolean = false> = SqlDriver<SqliteDriverConfig<Bigint>>

export {
	betterSqlite3Driver,
	nodeSqliteDriver,
	type BetterSqlite3Like,
	type NodeSqliteLike,
} from "./sqlite-sql-driver.ts"
export type { SqliteDriverConfig as SqliteDriver, SqliteDriverOptions, SqliteTypeMap } from "./sqlite-type-map.ts"
