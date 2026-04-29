import type { JsqlDatabaseShape } from "typesql"

/**
 * Runtime database handle stored in Nest config.
 *
 * Keep this intentionally light so `forRootAsync` factories do not need to
 * expand the full `DataBase` generic graph at the return site.
 */
type TypesqlDatabase<Db extends JsqlDatabaseShape = JsqlDatabaseShape> = {
	$db: Db
	query: (...args: any[]) => Promise<Array<unknown>>
	stream: (...args: any[]) => AsyncIterable<unknown>
}

/**
 * Everything needed to expose typesql inside Nest: database object (includes the runtime {@link SqlDriver}
 * passed to {@link sqlDatabase}), and optional teardown (e.g. `postgres` client `end()`).
 */
export type TypesqlRootConfig<Db extends JsqlDatabaseShape = JsqlDatabaseShape> = {
	database: TypesqlDatabase<Db>
	onShutdown?: { end: (opts?: { timeout?: number }) => Promise<void> }
}
