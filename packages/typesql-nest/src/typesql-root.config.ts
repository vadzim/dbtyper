import type { CompiledDataBase, JsqlDatabaseShape, SqlDriver } from "typesql"

/**
 * Everything needed to expose typesql inside Nest: compiled schema, runtime driver,
 * and optional teardown (e.g. `postgres` client `end()`).
 */
export type TypesqlRootConfig<Db extends JsqlDatabaseShape = JsqlDatabaseShape> = {
	compiled: CompiledDataBase<Db>
	driver: SqlDriver
	onShutdown?: { end: (opts?: { timeout?: number }) => Promise<void> }
}
