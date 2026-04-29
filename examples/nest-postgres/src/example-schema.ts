import { sqlDatabase } from "typesql"
import type { PostgresDriver } from "typesql/postgres"

/**
 * All migrations (DDL + seed) participate in compile-time checking; runtime migrate applies the same files.
 *
 * @param driver `PostgresDriver` from `postgresSqlDriver({ sql })` (`typesql/postgres`) — use the same client for `compile()` and runtime `connect()`.
 */
export async function compileExampleDb(driver: PostgresDriver) {
	return await sqlDatabase({ driver })
		.apply(import("../migrations/001_schemas.ts"))
		.apply(import("../migrations/002_users.ts"))
		.apply(import("../migrations/003_agenda.ts"))
		.apply(import("../migrations/004_seed_users.ts"))
		.compile()
}

/** Logical schema shape after `compile()` (for `ConnectedDataBase<…>` in services). */
export type ExampleDbShape = Awaited<ReturnType<typeof compileExampleDb>>["$db"]
