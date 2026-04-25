import type { DropTableStatement } from "../parser/parse-drop-table.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { SqlDatabaseLike, SqlSchemaLike } from "./sql-database.ts"
import type { DropFromSchemas, ResolveQualifiedIdentifier, TableExists } from "./helpers/engine-helpers.ts"

export type ApplyDropTable<Db extends SqlDatabaseLike, Drop extends DropTableStatement> =
	ResolveQualifiedIdentifier<Drop["target"], Db["defaultSchema"]> extends [
		infer Schema extends string,
		infer Table extends string,
	]
		? Db["schemas"] extends Record<string, SqlSchemaLike>
			? TableExists<Db["schemas"], Schema, Table> extends true
				? {
						defaultSchema: Db["defaultSchema"]
						schemas: DropFromSchemas<Extract<Db["schemas"], Record<string, SqlSchemaLike>>, Schema, Table>
					}
				: Drop["ifExists"] extends true
					? Db
					: SqlParserError<`Unknown dropped table "${Schema}.${Table}" in database`>
			: SqlParserError<"Internal SqlApplyDropTable schema shape error">
		: SqlParserError<"Internal SqlApplyDropTable target error">
