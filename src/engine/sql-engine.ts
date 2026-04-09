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
