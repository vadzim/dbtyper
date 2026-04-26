import type { SqlQualifiedIdentifier } from "../../parser/sql-primitives.ts"
import type { JsqlSchemaShape } from "../jsql-shapes.ts"

export type SchemaExists<
	Schemas extends Record<string, JsqlSchemaShape>,
	Name extends string,
> = Name extends keyof Schemas ? true : false

export type TableExists<
	Schemas extends Record<string, JsqlSchemaShape>,
	Schema extends string,
	Table extends string,
> = Schema extends keyof Schemas ? (Table extends keyof Schemas[Schema]["tables"] ? true : false) : false

export type DropSchemaFromSchemas<
	Schemas extends Record<string, JsqlSchemaShape>,
	Name extends string,
> = Name extends keyof Schemas ? Omit<Schemas, Name> : Schemas

export type DropFromSchemas<
	Schemas extends Record<string, JsqlSchemaShape>,
	Schema extends string,
	Table extends string,
> = Schema extends keyof Schemas
	? {
			[K in keyof (Omit<Schemas, Schema> & {
				[K2 in Schema]: {
					tables: Omit<Schemas[K2]["tables"], Table>
				}
			})]: (Omit<Schemas, Schema> & {
				[K2 in Schema]: {
					tables: Omit<Schemas[K2]["tables"], Table>
				}
			})[K]
		}
	: Schemas

export type ResolveQualifiedIdentifier<
	Name extends SqlQualifiedIdentifier,
	DefaultSchema extends string,
> = Name extends [infer Table extends string]
	? [DefaultSchema, Table]
	: Name extends [infer Table extends string, infer Schema extends string]
		? [Schema, Table]
		: never

export type MergeSchemas<
	Schemas extends Record<string, JsqlSchemaShape>,
	Schema extends string,
	Table extends string,
	TableDef,
> = {
	[K in keyof (Schemas & {
		[K2 in Schema]: K2 extends keyof Schemas
			? {
					tables: {
						[K3 in keyof (Schemas[K2]["tables"] & {
							[T in Table]: TableDef
						})]: (Schemas[K2]["tables"] & {
							[T in Table]: TableDef
						})[K3]
					}
				}
			: {
					tables: {
						[T in Table]: TableDef
					}
				}
	})]: (Schemas & {
		[K2 in Schema]: K2 extends keyof Schemas
			? {
					tables: {
						[K3 in keyof (Schemas[K2]["tables"] & {
							[T in Table]: TableDef
						})]: (Schemas[K2]["tables"] & {
							[T in Table]: TableDef
						})[K3]
					}
				}
			: {
					tables: {
						[T in Table]: TableDef
					}
				}
	})[K]
}
