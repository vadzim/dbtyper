import type { SqlDriver } from "../engine/sql-database.ts"
import type { PostgresTypeMap } from "./postgres-type-map.ts"

/** PostgreSQL {@link SqlDriver} carrying {@link PostgresTypeMap} on {@link SqlDriver.scalarTypes}. */
export type PostgresDriver = SqlDriver<PostgresTypeMap>

/** Satisfies {@link SqlDriver.scalarTypes} for Postgres drivers; not read by typesql. */
export const postgresDriverScalarTypesBrand = {} as PostgresTypeMap
