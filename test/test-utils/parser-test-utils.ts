import type { SqlDatabase } from "../../src/core/sql-database.ts"

/** Default scalar map from {@link SqlDatabase} — add `scalarTypes: PackageScalarTypes` on manual test DB shapes. */
export type PackageScalarTypes = SqlDatabase["scalarTypes"]
