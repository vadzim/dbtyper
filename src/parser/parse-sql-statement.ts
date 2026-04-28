import type {
	PeekToken,
	SkipToken,
	TokensList,
	TokenEot,
	TokenKey,
	ParseSqlTokens,
	SqlParserError,
} from "../../core/sql-tokens.ts"
import type { JsqlDatabaseShape } from "../../core/jsql-shapes.ts"
import type { ParseCreateSchema } from "./parse-create-schema.ts"
import type { ParseCreateTable } from "./parse-create-table.ts"
import type { ParseDelete } from "./parse-delete.ts"
import type { ParseDropSchema } from "./parse-drop-schema.ts"
import type { ParseDropTable } from "./parse-drop-table.ts"
import type { ParseSelect } from "./parse-select.ts"
import type { ParseSkipStatement } from "./skip-statement.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "./parse-expression.ts"

export type ApplyStatements<
	Db extends JsqlDatabaseShape | SqlParserError<string>,
	Text extends string,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Db extends JsqlDatabaseShape
	? ApplyParsedStatements<ParseSqlTokens<Text>, Db, Params> extends [
			infer _Rest extends TokensList,
			infer NewDB extends JsqlDatabaseShape,
		]
		? NewDB
		: never
	: Db

export type ApplyParsedStatements<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends TokenEot
		? [Tokens, Db]
		: ParseSqlStatement<Tokens, Db, Params> extends [
					infer Rest extends TokensList,
					infer NewDB extends JsqlDatabaseShape,
					infer Result,
			  ]
			? Result extends SqlParserError<string>
				? [Rest, NewDB]
				: ApplyParsedStatements<Rest, NewDB, Params>
			: never

export type ParseSqlStatement<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends TokenEot
		? [Tokens, Db, null]
		: PeekToken<Tokens> extends TokenKey<"create">
			? ParseCreate<SkipToken<Tokens>, Db>
			: PeekToken<Tokens> extends TokenKey<"drop">
				? ParseDrop<SkipToken<Tokens>, Db>
				: PeekToken<Tokens> extends TokenKey<"delete">
					? ParseDelete<SkipToken<Tokens>, Db, Params>
					: PeekToken<Tokens> extends TokenKey<"select">
						? ParseSelect<SkipToken<Tokens>, Db, Params>
						: ParseSkipStatement<Tokens, Db>

type ParseCreate<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"table">
		? ParseCreateTable<SkipToken<Tokens>, Db>
		: PeekToken<Tokens> extends TokenKey<"schema">
			? ParseCreateSchema<SkipToken<Tokens>, Db>
			: ParseSkipStatement<Tokens, Db>

type ParseDrop<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"table">
		? ParseDropTable<SkipToken<Tokens>, Db>
		: PeekToken<Tokens> extends TokenKey<"schema">
			? ParseDropSchema<SkipToken<Tokens>, Db>
			: ParseSkipStatement<Tokens, Db>
