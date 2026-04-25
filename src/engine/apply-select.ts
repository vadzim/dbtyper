import type { SelectStatement } from "../parser/parse-select.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { SqlDatabaseLike } from "./sql-database.ts"
import type { SelectRow } from "./infer-select-row.ts"

export type ApplySelect<Db extends SqlDatabaseLike, Stmt extends SelectStatement> =
	SelectRow<Db, Stmt> extends infer R ? (R extends SqlParserError<string> ? R : Db) : never
