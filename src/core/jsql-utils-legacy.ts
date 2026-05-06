import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlSelectStatementResult, JsqlTableShape } from "./jsql-shapes.ts"
import type { JsqlDbGetSet } from "./jsql-utils.ts"
import type { I } from "./type-utils.ts"

/** Remove a type from the database. */

export type RemoveTypeFromDb<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Typ extends string,
> = Sch extends keyof Db["schemas"]
	? {
			defaultSchema: Db["defaultSchema"]
			schemas: {
				[K in keyof Db["schemas"]]: K extends Sch
					? { types: Omit<I<I<Db, "schemas", {}>, Sch, JsqlSchemaShape>["types"], Typ> } & Omit<
							I<I<Db, "schemas", {}>, Sch, JsqlSchemaShape>,
							"types"
						>
					: Db["schemas"][K]
			}
		}
	: never /** Update an existing type (enum) with new values. */

export type UpdateTypeInDb<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Typ extends string,
	NewValues extends readonly string[],
> = Sch extends keyof Db["schemas"]
	? {
			defaultSchema: Db["defaultSchema"]
			schemas: {
				[K in keyof Db["schemas"]]: K extends Sch
					? {
							types: {
								[T in keyof I<
									I<Db, "schemas", {}>,
									Sch & keyof Db["schemas"],
									JsqlSchemaShape
								>["types"]]: T extends Typ
									? { kind: "enum"; values: NewValues }
									: I<I<Db, "schemas", {}>, Sch & keyof Db["schemas"], JsqlSchemaShape>["types"][T]
							}
						} & Omit<I<I<Db, "schemas", {}>, Sch & keyof Db["schemas"], JsqlSchemaShape>, "types">
					: Db["schemas"][K]
			}
		}
	: never
/** Add a type (enum) to the database. */

export type MergeTypeIntoDb<
	Db extends JsqlDatabaseShape,
	Schema extends string,
	TypeName extends string,
	Values extends readonly string[],
> = Schema extends keyof Db["schemas"]
	? {
			defaultSchema: Db["defaultSchema"]
			schemas: {
				[K in keyof Db["schemas"]]: K extends Schema
					? {
							types: (I<I<Db, "schemas", {}>, K, JsqlSchemaShape>["types"] extends object
								? I<I<Db, "schemas", {}>, K, JsqlSchemaShape>["types"]
								: {}) &
								Record<TypeName, { kind: "enum"; values: Values }>
						} & Omit<I<I<Db, "schemas", {}>, K, JsqlSchemaShape>, "types">
					: Db["schemas"][K]
			}
		}
	: never
/** Add a view to the database. */

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
/** Remove a table from the database. */

export type RemoveTableFromDb<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> = Sch extends keyof Db["schemas"]
	? {
			defaultSchema: Db["defaultSchema"]
			schemas: {
				[K in keyof Db["schemas"]]: K extends Sch
					? { sets: Omit<I<I<Db, "schemas", {}>, Sch, JsqlSchemaShape>["sets"], Tab> } & Omit<
							I<I<Db, "schemas", {}>, Sch, JsqlSchemaShape>,
							"sets"
						>
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
/** Remove a schema from the database. */

export type RemoveSchemaFromDb<Db extends JsqlDatabaseShape, Sch extends keyof Db["schemas"]> = {
	defaultSchema: Db["defaultSchema"]
	schemas: Omit<Db["schemas"], Sch>
}
/** Add a new schema to the database. */

export type MergeSchemaIntoDb<Db extends JsqlDatabaseShape, Name extends string> = {
	defaultSchema: Db["defaultSchema"]
	schemas: Db["schemas"] & Record<Name, { sets: {} }>
}

export type ResolveTableShape<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string> =
	JsqlDbGetSet<Db, Sch, Tab> extends infer T extends object ? T : never
