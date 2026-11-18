import type { JsqlDatabaseShape } from "./jsql-shapes.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { ExpressionParamsShape } from "../parser/parse-expression.ts"
import type { TypedStatements } from "./grammar-typing.ts"
import type { DriverConfig } from "./sql-database.ts"
import type { SqlTypeShape } from "./sql-type-shape.ts"
import type { ApplySqlToTsConversion } from "./sql-to-ts-conversion.ts"

type ExpectedRowSetResult = FormatError<Errors["STREAM_REQUIRES_A_ROW_RETURNING_STATEMENT"], []>

/**
 * Returns SQL column types as strings (e.g., { id: "uuid", name: "text" }).
 * This is the internal representation before conversion to TypeScript types.
 *
 * For the public API with TypeScript types, import SqlSelectRow from sql-database.ts or index.ts.
 */
type SqlSelectResult<
	Config extends DriverConfig,
	Db extends JsqlDatabaseShape,
	Text extends string,
	Params extends ExpressionParamsShape | null,
> =
	TypedStatements<Config, Db, Text, Params> extends [unknown, infer Error, infer Result]
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
	Params extends ExpressionParamsShape | null,
> = ApplySqlToTsConversion<Config, SqlSelectResult<Config, Db, Text, Params>>
