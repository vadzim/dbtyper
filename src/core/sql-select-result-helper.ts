import type { JsqlDatabaseShape } from "./jsql-shapes.ts"
import type { DbtyperErrorShape, FormatError } from "../dbtyper-error.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "../parser/parse-expression.ts"
import type { ApplyStatements } from "../parser/parse-sql-statement.ts"
import type { DriverConfig } from "./sql-database.ts"
import type { SqlTypeShape } from "./sql-type-shape.ts"
import type { ApplySqlToTsConversion } from "./sql-to-ts-conversion.ts"
import type { LexerFeatures } from "../lexer/sql-lexer.ts"

type ExpectedRowSetResult = FormatError<"STREAM_REQUIRES_A_ROW_RETURNING_STATEMENT", []>

/**
 * Returns SQL column types as strings (e.g., { id: "uuid", name: "text" }).
 * This is the internal representation before conversion to TypeScript types.
 *
 * For the public API with TypeScript types, import SqlSelectRow from sql-database.ts or index.ts.
 */
type SqlSelectResult<
	Db extends JsqlDatabaseShape,
	Text extends string,
	Params extends ExpressionParamsShape,
	Syntax extends LexerFeatures,
> =
	ApplyStatements<Db, Text, Params, Syntax> extends [unknown, infer Error, infer Result]
		? Error extends DbtyperErrorShape
			? Error
			: Result extends { returning: Record<string, SqlTypeShape> }
				? Result["returning"]
				: ExpectedRowSetResult
		: ExpectedRowSetResult

/**
 * Infers the **row object** type for SELECT/RETURNING statements.
 * Used by .stream() which requires statements that return rows.
 */
export type SqlSelectResultTs<
	Config extends DriverConfig,
	Db extends JsqlDatabaseShape,
	Text extends string,
	Params extends ExpressionParamsShape,
> = ApplySqlToTsConversion<Config, SqlSelectResult<Db, Text, Params, Config["syntax"]>>
