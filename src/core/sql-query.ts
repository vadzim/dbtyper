import type {
	JsqlDatabaseShape,
	JsqlInsertStatementResult,
	JsqlSelectStatementResult,
	JsqlUpdateStatementResult,
} from "./jsql-shapes.ts"
import type { ParseSqlTokens, TokensList } from "../lexer/sql-tokens.ts"
import type { SqlParserError, DbtyperError, FormatError } from "../sql-parser-error.ts"
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
			: Res extends DbtyperError<any, any>
				? Res
				: RowShapeFromStatementResult<Res>
		: never

type ExpectedRowSetResult = FormatError<"STREAM_REQUIRES_A_ROW_RETURNING_STATEMENT", []>

type RowShapeFromStatementResult<Res> = Res extends JsqlSelectStatementResult
	? Res["columns"]
	: Res extends JsqlInsertStatementResult
		? Res extends { returning: infer Ret extends JsqlSelectStatementResult }
			? Ret["columns"]
			: ExpectedRowSetResult
		: Res extends JsqlUpdateStatementResult
			? Res extends { returning: infer Ret extends JsqlSelectStatementResult }
				? Ret["columns"]
				: ExpectedRowSetResult
			: Res extends null
				? ExpectedRowSetResult
				: ExpectedRowSetResult

/**
 * Returns SQL column types as strings (e.g., { id: "uuid", name: "text" }).
 * This is the internal representation before conversion to TypeScript types.
 *
 * For the public API with TypeScript types, import SqlSelectRow from sql-database.ts or index.ts.
 */
export type SqlSelectRowSqlTypes<
	Db extends JsqlDatabaseShape | SqlParserError<string> | DbtyperError<any, any>,
	Text extends string,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	Db extends SqlParserError<string>
		? Db
		: Db extends DbtyperError<any, any>
			? Db
			: Db extends JsqlDatabaseShape
				? SqlSelectRowForDb<Db, Text, Params>
				: never
