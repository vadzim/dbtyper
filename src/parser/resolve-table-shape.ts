import type { I, JsqlDatabaseShape, JsqlSchemaShape, JsqlTableShape } from "../core/jsql-shapes.ts"

export type ResolveTableShape<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> = Sch extends keyof Db["schemas"]
	? Tab extends keyof I<I<Db, "schemas", {}>, Sch, JsqlSchemaShape>["sets"]
		? I<I<I<Db, "schemas", {}>, Sch, JsqlSchemaShape>, "sets", {}>[Tab]
		: never
	: never
