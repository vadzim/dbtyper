import type { JsqlDatabaseShape, JsqlDbGetSet } from "../core/jsql-shapes.ts"

export type ResolveTableShape<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string> =
	JsqlDbGetSet<Db, Sch, Tab> extends infer T extends object ? T : never
