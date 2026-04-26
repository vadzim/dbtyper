import type { ParseSqlTokens, SqlParserError, TokensList } from "../../core/sql-tokens.ts"
import type { SelectStatement } from "../parser/parse-select.ts"
import type { ParseSingleStatement } from "../parser/parse-sql-statement.ts"
import type { SqlStatement } from "./apply-statement.ts"
import type { SelectRow } from "./infer-select-row.ts"
import type { JsqlDatabaseShape } from "./jsql-shapes.ts"

export type SqlApplyQuery<
	Db extends JsqlDatabaseShape | SqlParserError<string>,
	Query extends SqlStatement,
> = Db extends JsqlDatabaseShape
	? Query extends SelectStatement
		? SelectRow<Db, Query>
		: Query extends SqlParserError<string>
			? Query
			: SqlParserError<"Unsupported SqlApplyQuery">
	: Db

export type SqlApplyQueryText<Db extends JsqlDatabaseShape | SqlParserError<string>, Stmt extends string> = SqlApplyQuery<
	Db,
	ParseSingleStatement<ParseSqlTokens<Stmt>> extends [infer _ extends TokensList, infer Result extends SqlStatement]
		? Result
		: never
>
