import type { InsertValuesStatement } from "../parser/parse-insert-values.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { SqlDatabaseLike } from "./sql-database.ts"
import type { ResolveQualifiedIdentifier, SchemaExists, TableExists } from "./helpers/engine-helpers.ts"

export type ApplyInsertValues<Db extends SqlDatabaseLike, Stmt extends InsertValuesStatement> =
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
	Cols extends string[],
	Vals extends unknown[],
> = Cols extends [infer C extends string, ...infer CR extends string[]]
	? Vals extends [infer _V, ...infer VR extends unknown[]]
		? C extends keyof Row
			? ValidateInsertValues<Row, CR, VR>
			: SqlParserError<`Unknown column "${C & string}" in INSERT`>
		: SqlParserError<"INSERT column count does not match value count">
	: Cols extends []
		? Vals extends []
			? never
			: SqlParserError<"INSERT column count does not match value count">
		: SqlParserError<"INSERT column count does not match value count">
