import type { SelectStatement } from "../parser/parse-select.ts"
import type { SqlSchemaLike, SqlDatabaseLike } from "./sql-database.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { ResolveQualifiedIdentifier, SchemaExists, TableExists } from "./helpers/engine-helpers.ts"

/** Row type emitted for `Stmt` when `Db` has the `FROM` table, or a parse-time error. */
export type SelectRow<Db extends SqlDatabaseLike, Stmt extends SelectStatement> =
	ResolveQualifiedIdentifier<Stmt["from"], Db["defaultSchema"]> extends [
		infer Schema extends string,
		infer Table extends string,
	]
		? Db["schemas"] extends Record<string, SqlSchemaLike>
			? SchemaExists<Extract<Db["schemas"], Record<string, SqlSchemaLike>>, Schema> extends true
				? TableExists<Db["schemas"], Schema, Table> extends true
					? Stmt["columns"] extends "star"
						? Extract<Db["schemas"][Schema]["tables"][Table]["columns"], Record<string, unknown>>
						: Stmt["columns"] extends string[]
							? BuildNamedColumnsRow<
									Extract<Db["schemas"][Schema]["tables"][Table]["columns"], Record<string, unknown>>,
									Stmt["columns"]
								>
							: SqlParserError<"Internal SELECT columns shape">
					: SqlParserError<`Unknown table for SELECT: "${Schema}.${Table}"`>
				: SqlParserError<`Unknown schema for SELECT: "${Schema}"`>
			: SqlParserError<"Internal SELECT schema shape error">
		: SqlParserError<"Internal SELECT FROM resolution error">

type BuildNamedColumnsRow<Columns extends Record<string, unknown>, Names extends string[]> = Names extends []
	? {}
	: Names extends [infer F extends string, ...infer R extends string[]]
		? F extends keyof Columns
			? BuildNamedColumnsRow<Columns, R> extends infer Sub
				? Sub extends SqlParserError<string>
					? Sub
					: Sub extends Record<string, unknown>
						? { [K in F]: Columns[F] } & Sub
						: SqlParserError<"Internal SELECT row build error">
				: never
			: SqlParserError<`Unknown column "${F & string}" in SELECT`>
		: never
