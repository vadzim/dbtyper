import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { JsqlDbGetSet } from "../core/jsql-utils.ts"

export type ResolveTableShape<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string> =
	JsqlDbGetSet<Db, Sch, Tab> extends infer T extends object ? T : never
