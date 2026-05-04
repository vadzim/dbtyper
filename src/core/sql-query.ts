import type {
	JsqlDatabaseShape,
	JsqlInsertStatementResult,
	JsqlSelectStatementResult,
	JsqlUpdateStatementResult,
} from "./jsql-shapes.ts"
import type { ParseSqlTokens, TokensList } from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
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
			: RowShapeFromStatementResult<Res>
		: never

type RowShapeFromStatementResult<Res> = Res extends JsqlSelectStatementResult
	? Res["columns"]
	: Res extends JsqlInsertStatementResult
		? Res extends { returning: infer Ret extends JsqlSelectStatementResult }
			? Ret["columns"]
			: SqlParserError<"Expected SELECT (or WITH … SELECT) for row typing">
		: Res extends JsqlUpdateStatementResult
			? Res extends { returning: infer Ret extends JsqlSelectStatementResult }
				? Ret["columns"]
				: SqlParserError<"Expected SELECT (or WITH … SELECT) for row typing">
			: Res extends null
				? SqlParserError<"Expected SELECT (or WITH … SELECT) for row typing">
				: SqlParserError<"Expected SELECT (or WITH … SELECT) for row typing">

/**
 * Returns SQL column types as strings (e.g., { id: "uuid", name: "text" }).
 * This is the internal representation before conversion to TypeScript types.
 *
 * For the public API with TypeScript types, import SqlSelectRow from sql-database.ts or index.ts.
 */
export type SqlSelectRowSqlTypes<
	Db extends JsqlDatabaseShape | SqlParserError<string>,
	Text extends string,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Db extends SqlParserError<string> ? Db : Db extends JsqlDatabaseShape ? SqlSelectRowForDb<Db, Text, Params> : never
