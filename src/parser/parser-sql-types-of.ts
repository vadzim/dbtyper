import type { JsqlTableShape } from "../core/jsql-shapes.ts"

export type SqlTypesOf<Tbl extends JsqlTableShape> = Tbl["columns"]
