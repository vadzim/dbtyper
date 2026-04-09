import type { SqlQualifiedIdentifier } from "../parser/sql-parse-primitives.js"

export type TableExists<
	Schemas extends Record<string, Record<string, unknown>>,
	Schema extends string,
	Table extends string,
> = Schema extends keyof Schemas ? (Table extends keyof Schemas[Schema] ? true : false) : false

export type DropFromSchemas<
	Schemas extends Record<string, Record<string, unknown>>,
	Schema extends string,
	Table extends string,
> = Schema extends keyof Schemas
	? {
			[K in keyof (Omit<Schemas, Schema> & {
				[K2 in Schema]: Omit<Schemas[K2], Table>
			})]: (Omit<Schemas, Schema> & {
				[K2 in Schema]: Omit<Schemas[K2], Table>
			})[K]
		}
	: Schemas

export type ResolveQualifiedIdentifier<
	Name extends SqlQualifiedIdentifier,
	DefaultSchema extends string,
> = Name extends readonly [infer Table extends string]
	? [DefaultSchema, Table]
	: Name extends readonly [infer Table extends string, infer Schema extends string]
		? [Schema, Table]
		: never

export type MergeSchemas<
	Schemas extends Record<string, Record<string, unknown>>,
	Schema extends string,
	Table extends string,
	Row,
> = {
	[K in keyof (Schemas & {
		[K2 in Schema]: K2 extends keyof Schemas
			? {
					[K3 in keyof (Schemas[K2] & {
						[T in Table]: Row
					})]: (Schemas[K2] & {
						[T in Table]: Row
					})[K3]
				}
			: {
					[T in Table]: Row
				}
	})]: (Schemas & {
		[K2 in Schema]: K2 extends keyof Schemas
			? {
					[K3 in keyof (Schemas[K2] & {
						[T in Table]: Row
					})]: (Schemas[K2] & {
						[T in Table]: Row
					})[K3]
				}
			: {
					[T in Table]: Row
				}
	})[K]
}
