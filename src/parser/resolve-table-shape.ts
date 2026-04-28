import type { JsqlDatabaseShape, JsqlTableShape } from "../../core/jsql-shapes.ts"

export type ResolveTableShape<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> = Sch extends keyof Db["schemas"]
	? Tab extends keyof Db["schemas"][Sch]["tables"]
		? Db["schemas"][Sch]["tables"][Tab]
		: never
	: never
