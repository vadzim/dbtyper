import { sqlDatabase } from "typesql"

/**
 * All migrations (DDL + seed) participate in compile-time checking; runtime migrate applies the same files.
 */
export async function compileExampleDb() {
	return await sqlDatabase("public")
		.apply(import("../migrations/001_schemas.ts"))
		.apply(import("../migrations/002_users.ts"))
		.apply(import("../migrations/003_agenda.ts"))
		.apply(import("../migrations/004_seed_users.ts"))
		// Optional: .apply(import("../migrations/020_catalog_patch.ts")) — must use patch(), see docs/MIGRATIONS.md
		.compile()
}

/** Migrations applied to Postgres (DDL + seed). Keep order stable; list only `migration()` modules. */
export const allMigrationFilenames = ["001_schemas.ts", "002_users.ts", "003_agenda.ts", "004_seed_users.ts"] as const

/** Optional patch modules (`patch()`). Same folder as migrations; keep disjoint from {@link allMigrationFilenames}. */
export const allPatchFilenames: readonly string[] = []

/** Logical schema shape after `compile()` (for `ConnectedDataBase<…>` in services). */
export type ExampleDbShape = Awaited<ReturnType<typeof compileExampleDb>>["$db"]
