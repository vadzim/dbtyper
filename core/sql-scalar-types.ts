import type { JsqlDatabaseShape } from "./jsql-shapes.ts"

/** Attach `scalarTypes` from `Db` onto parser-produced DB cores. */
export type MergeDbPreserveScalars<
	Db extends JsqlDatabaseShape,
	Core extends { defaultSchema: string; schemas: unknown },
> = Core & { scalarTypes: Db["scalarTypes"] }
