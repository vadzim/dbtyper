import type { CreateIndexStatement } from "../parser/parse-create-index.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { SqlDatabaseLike, SqlSchemaLike } from "./sql-database.ts"
import type { ResolveQualifiedIdentifier, SchemaExists, TableExists } from "./helpers/engine-helpers.ts"

export type ApplyCreateIndex<Db extends SqlDatabaseLike, Stmt extends CreateIndexStatement> =
	ResolveQualifiedIdentifier<Stmt["target"], Db["defaultSchema"]> extends [
		infer Schema extends string,
		infer Table extends string,
	]
		? Db["schemas"] extends Record<string, SqlSchemaLike>
			? SchemaExists<Extract<Db["schemas"], Record<string, SqlSchemaLike>>, Schema> extends true
				? TableExists<Db["schemas"], Schema, Table> extends true
					? ValidateIndexColumns<
							Extract<Db["schemas"][Schema]["tables"][Table]["columns"], Record<string, unknown>>,
							Stmt["columns"]
						> extends infer Err
						? [Err] extends [never]
							? Db
							: Err extends SqlParserError<string>
								? Err
								: SqlParserError<"Internal CREATE INDEX validation error">
						: SqlParserError<"Internal CREATE INDEX validation error">
					: SqlParserError<`Unknown table for CREATE INDEX: "${Schema}.${Table}"`>
				: SqlParserError<`Unknown schema for CREATE INDEX: "${Schema}"`>
			: SqlParserError<"Internal CREATE INDEX schema shape error">
		: SqlParserError<"Internal CREATE INDEX target error">

type ValidateIndexColumns<Row extends Record<string, unknown>, Cols extends string[]> = Cols extends [
	infer H extends string,
	...infer R extends string[],
]
	? H extends keyof Row
		? ValidateIndexColumns<Row, R>
		: SqlParserError<`Unknown column "${H}" in CREATE INDEX`>
	: Cols extends []
		? never
		: SqlParserError<"Internal CREATE INDEX columns error">
