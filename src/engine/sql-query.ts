import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../../core/jsql-shapes.ts"
import type { ParseSqlTokens, SqlParserError, TokensList } from "../../core/sql-tokens.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "../parser/parse-expression.ts"
import type { ParseSqlStatement } from "../parser/parse-sql-statement.ts"

type SqlSelectRowForDb<
	Db extends JsqlDatabaseShape,
	Text extends string,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ParseSqlStatement<ParseSqlTokens<Text>, Db, Params> extends [infer _Rest extends TokensList, infer _Db, infer Res]
		? Res extends SqlParserError<string>
			? Res
			: Res extends JsqlSelectStatementResult
				? Res["columns"]
				: SqlParserError<"Expected SELECT (or WITH … SELECT) for row typing">
		: never

/**
 * Infers the **row object** type for a single `SELECT` / `WITH … SELECT` string against `Db`.
 * Non-select statements resolve to {@link SqlParserError} so invalid uses become type errors.
 */
export type SqlSelectRow<
	Db extends JsqlDatabaseShape | SqlParserError<string>,
	Text extends string,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Db extends SqlParserError<string> ? Db : Db extends JsqlDatabaseShape ? SqlSelectRowForDb<Db, Text, Params> : never
