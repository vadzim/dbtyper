import type { JsqlDataShape } from "../core/jsql-shapes.ts"

export type SqlTypesOf<Tbl extends JsqlDataShape> = Tbl["columns"]
