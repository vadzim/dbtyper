import type { SelectStatement } from "../parser/parse-select.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { JsqlDatabaseShape } from "./jsql-shapes.ts"
import type { SelectRow } from "./infer-select-row.ts"

export type ApplySelect<Db extends JsqlDatabaseShape, Stmt extends SelectStatement> =
	SelectRow<Db, Stmt> extends infer R ? (R extends SqlParserError<string> ? R : Db) : never
