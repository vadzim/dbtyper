import type { DataBase, JsqlDatabaseShape } from "typesql"

/**
 * Everything needed to expose typesql inside Nest: database object (includes the runtime {@link SqlDriver}
 * passed to {@link sqlDatabase}), and optional teardown (e.g. `postgres` client `end()`).
 */
export type TypesqlRootConfig<Db extends JsqlDatabaseShape = JsqlDatabaseShape> = {
	database: DataBase<Db>
	onShutdown?: { end: (opts?: { timeout?: number }) => Promise<void> }
}
