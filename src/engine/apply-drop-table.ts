import type { DropTableStatement } from "../parser/parse-drop-table.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { JsqlDatabaseShape, JsqlSchemaShape } from "./jsql-shapes.ts"
import type { DropFromSchemas, ResolveQualifiedIdentifier, TableExists } from "./helpers/engine-helpers.ts"

export type ApplyDropTable<Db extends JsqlDatabaseShape, Drop extends DropTableStatement> =
	ResolveQualifiedIdentifier<Drop["target"], Db["defaultSchema"]> extends [
		infer Schema extends string,
		infer Table extends string,
	]
		? Db["schemas"] extends Record<string, JsqlSchemaShape>
			? TableExists<Db["schemas"], Schema, Table> extends true
				? {
						defaultSchema: Db["defaultSchema"]
						schemas: DropFromSchemas<Extract<Db["schemas"], Record<string, JsqlSchemaShape>>, Schema, Table>
					}
				: Drop["ifExists"] extends true
					? Db
					: SqlParserError<`Unknown dropped table "${Schema}.${Table}" in database`>
			: SqlParserError<"Internal SqlApplyDropTable schema shape error">
		: SqlParserError<"Internal SqlApplyDropTable target error">
