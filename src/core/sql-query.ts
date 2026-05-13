import type {
	JsqlDatabaseShape,
	JsqlInsertStatementResult,
	JsqlSelectStatementResult,
	JsqlUpdateStatementResult,
} from "./jsql-shapes.ts"
import type { CreateParserMonad } from "../lexer/parser-monad.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError } from "../dbtyper-error.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "../parser/parse-expression.ts"
import type { ParseSqlStatement } from "../parser/parse-sql-statement.ts"
import type { DriverConfig } from "./sql-database.ts"

type SqlSelectRowForDb<
	Config extends DriverConfig,
	Db extends JsqlDatabaseShape,
	Text extends string,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ParseSqlStatement<CreateParserMonad<Text, Config["syntax"]>, Db, Params> extends [
		infer _Rest extends ParserMonad,
		infer _Db,
		infer Res,
	]
		? Res extends DbtyperErrorShape
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
	Config extends DriverConfig,
	Db extends JsqlDatabaseShape | DbtyperErrorShape,
	Text extends string,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Db extends DbtyperErrorShape
	? Db
	: Db extends JsqlDatabaseShape
		? SqlSelectRowForDb<Config, Db, Text, Params>
		: never
