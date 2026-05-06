import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlSelectStatementResult, JsqlTableShape } from "./jsql-shapes.ts"
import type { I } from "./type-utils.ts"

export type MergeViewIntoDb<
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Name extends string,
	Sel extends JsqlSelectStatementResult,
> = Schema extends keyof Db["schemas"]
	? {
			defaultSchema: Db["defaultSchema"]
			schemas: {
				[K in keyof Db["schemas"]]: K extends Schema
					? {
							sets: I<I<Db, "schemas", {}>, K, JsqlSchemaShape>["sets"] &
								Record<
									Name,
									{
										kind: "view"
										columns: Sel["columns"]
									}
								>
						}
					: Db["schemas"][K]
			}
		}
	: never
/** Replace an existing table with a new shape (for ALTER TABLE operations). */

export type ReplaceTableInDb<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	NewShape extends JsqlTableShape,
> = Sch extends keyof Db["schemas"]
	? {
			defaultSchema: Db["defaultSchema"]
			schemas: {
				[K in keyof Db["schemas"]]: K extends Sch
					? I<I<Db, "schemas", {}>, K, JsqlSchemaShape>["types"] extends object
						? {
								sets: Omit<I<I<Db, "schemas", {}>, K, JsqlSchemaShape>["sets"], Tab> &
									Record<Tab, NewShape>
								types: I<I<Db, "schemas", {}>, K, JsqlSchemaShape>["types"]
							}
						: {
								sets: Omit<I<I<Db, "schemas", {}>, K, JsqlSchemaShape>["sets"], Tab> &
									Record<Tab, NewShape>
							}
					: Db["schemas"][K]
			}
		}
	: never
/** Add or replace a table in the database. */

export type MergeTableIntoDb<
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Cols extends Record<string, string>,
	Facts extends Record<string, unknown>,
> = Schema extends keyof Db["schemas"]
	? {
			defaultSchema: Db["defaultSchema"]
			schemas: {
				[K in keyof Db["schemas"]]: K extends Schema
					? {
							sets: I<I<Db, "schemas", {}>, K, JsqlSchemaShape>["sets"] &
								Record<
									Table,
									{
										kind: "table"
										columns: Cols
										column_facts: Facts
									}
								>
						} & Omit<I<I<Db, "schemas", {}>, K, JsqlSchemaShape>, "sets">
					: Db["schemas"][K]
			}
		}
	: never
/** Add a new schema to the database. */

export type MergeSchemaIntoDb<Db extends JsqlDatabaseShape, Name extends string> = {
	defaultSchema: Db["defaultSchema"]
	schemas: Db["schemas"] & Record<Name, { sets: {} }>
}
