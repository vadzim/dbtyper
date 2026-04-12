import type { SqlInsertValues } from "../parser/sql-insert-values.js"
import type { SqlParserError } from "../parser/sql-tokens.js"
import type { SqlDatabaseLike } from "./sql-database.js"
import type { ResolveQualifiedIdentifier, SchemaExists, TableExists } from "./helpers/engine-helpers.js"

export type ApplyInsertValues<Db extends SqlDatabaseLike, Stmt extends SqlInsertValues> =
	ResolveQualifiedIdentifier<Stmt["target"], Db["defaultSchema"]> extends [
		infer Schema extends string,
		infer Table extends string,
	]
		? Db["schemas"] extends Record<string, Record<string, unknown>>
			? SchemaExists<Extract<Db["schemas"], Record<string, Record<string, unknown>>>, Schema> extends true
				? TableExists<Db["schemas"], Schema, Table> extends true
					? ValidateInsertValues<
							Extract<Db["schemas"][Schema][Table], Record<string, unknown>>,
							Stmt["columns"],
							Stmt["valueTypes"]
						> extends infer Err
						? [Err] extends [never]
							? Db
							: Err extends SqlParserError<string>
								? Err
								: SqlParserError<"Internal INSERT validation error">
						: SqlParserError<"Internal INSERT validation error">
					: SqlParserError<`Unknown table for INSERT: "${Schema}.${Table}"`>
				: SqlParserError<`Unknown schema for INSERT: "${Schema}"`>
			: SqlParserError<"Internal INSERT schema shape error">
		: SqlParserError<"Internal INSERT target error">

type ValidateInsertValues<
	Row extends Record<string, unknown>,
	Cols extends readonly string[],
	Vals extends readonly unknown[],
> = Cols extends readonly [infer C extends string, ...infer CR extends readonly string[]]
	? Vals extends readonly [infer _V, ...infer VR extends readonly unknown[]]
		? C extends keyof Row
			? ValidateInsertValues<Row, CR, VR>
			: SqlParserError<`Unknown column "${C & string}" in INSERT`>
		: SqlParserError<"INSERT column count does not match value count">
	: Cols extends readonly []
		? Vals extends readonly []
			? never
			: SqlParserError<"INSERT column count does not match value count">
		: SqlParserError<"INSERT column count does not match value count">
