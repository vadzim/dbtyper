import type { JsqlTableShape } from "../core/jsql-shapes.ts"

export type SqlTypesOf<Tbl extends JsqlTableShape> = Tbl["column_sql_types"] extends infer S
	? S extends Record<string, string>
		? S
		: Record<string, string>
	: Record<string, string>
