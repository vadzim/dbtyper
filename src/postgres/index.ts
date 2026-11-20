import type { SqlDriver } from "../core/sql-database.ts"
import type { PostgresDriverConfig } from "./postgres-sql-driver.ts"

/** What {@link postgresSqlDriver} returns: a `SqlDriver` of the PostgreSQL config (RUN-20; `Bigint` = int8 parsed to BigInt, PGT-4). */
export type PostgresSqlDriver<Bigint extends boolean = false> = SqlDriver<PostgresDriverConfig<Bigint>>

export {
	postgresSqlDriver,
	type PostgresSqlDriverConfig,
	type PostgresDriverConfig as PostgresDriver,
} from "./postgres-sql-driver.ts"
export type { PostgresTypeMap, PostgresParamTypeMap, JsonValue } from "./postgres-type-map.ts"
