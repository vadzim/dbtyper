import type { CompiledDataBase, JsqlDatabaseShape } from "typesql"

/**
 * Everything needed to expose typesql inside Nest: compiled schema (includes the runtime {@link SqlDriver}
 * passed to {@link sqlDatabase}), and optional teardown (e.g. `postgres` client `end()`).
 */
export type TypesqlRootConfig<Db extends JsqlDatabaseShape = JsqlDatabaseShape> = {
	compiled: CompiledDataBase<Db>
	onShutdown?: { end: (opts?: { timeout?: number }) => Promise<void> }
}
