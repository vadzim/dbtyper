import type { SqlCreateIndex } from "../parser/sql-create-index.js"
import type { SqlParseError } from "../parser/sql-tokens.js"
import type { SqlDatabaseLike } from "./sql-database.js"
import type { ResolveQualifiedIdentifier, SchemaExists, TableExists } from "./helpers/engine-helpers.js"

export type ApplyCreateIndex<Db extends SqlDatabaseLike, Stmt extends SqlCreateIndex> =
	ResolveQualifiedIdentifier<Stmt["target"], Db["defaultSchema"]> extends [
		infer Schema extends string,
		infer Table extends string,
	]
		? Db["schemas"] extends Record<string, Record<string, unknown>>
			? SchemaExists<Extract<Db["schemas"], Record<string, Record<string, unknown>>>, Schema> extends true
				? TableExists<Db["schemas"], Schema, Table> extends true
					? ValidateIndexColumns<
							Extract<Db["schemas"][Schema][Table], Record<string, unknown>>,
							Stmt["columns"]
						> extends infer Err
						? [Err] extends [never]
							? Db
							: Err extends SqlParseError<string>
								? Err
								: SqlParseError<"Internal CREATE INDEX validation error">
						: SqlParseError<"Internal CREATE INDEX validation error">
					: SqlParseError<`Unknown table for CREATE INDEX: "${Schema}.${Table}"`>
				: SqlParseError<`Unknown schema for CREATE INDEX: "${Schema}"`>
			: SqlParseError<"Internal CREATE INDEX schema shape error">
		: SqlParseError<"Internal CREATE INDEX target error">

type ValidateIndexColumns<Row extends Record<string, unknown>, Cols extends readonly string[]> = Cols extends readonly [
	infer H extends string,
	...infer R extends readonly string[],
]
	? H extends keyof Row
		? ValidateIndexColumns<Row, R>
		: SqlParseError<`Unknown column "${H}" in CREATE INDEX`>
	: Cols extends readonly []
		? never
		: SqlParseError<"Internal CREATE INDEX columns error">
