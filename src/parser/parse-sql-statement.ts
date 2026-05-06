import type {
	PeekToken,
	SkipToken,
	TokensList,
	TokenEot,
	TokenIdent,
	TokenKey,
	ParseSqlTokens,
} from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { ParseAlterTable } from "./parse-alter-table.ts"
import type { ParseAlterType } from "./parse-alter-type.ts"
import type { ParseCreateSchema } from "./parse-create-schema.ts"
import type { ParseCreateTable } from "./parse-create-table.ts"
import type { ParseCreateType } from "./parse-create-type.ts"
import type { ParseCreateView } from "./parse-create-view.ts"
import type { ParseDelete } from "./parse-delete.ts"
import type { ParseDropSchema } from "./parse-drop-schema.ts"
import type { ParseDropTable } from "./parse-drop-table.ts"
import type { ParseDropType } from "./parse-drop-type.ts"
import type { ParseInsert } from "./parse-insert.ts"
import type { ParseSelect } from "./parse-select.ts"
import type { ParseUpdate } from "./parse-update.ts"
import type { ParseSkipStatement } from "./skip-statement.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "./parse-expression.ts"
import type { Inc } from "../core/type-utils.ts"

export type ApplyStatements<
	Db extends JsqlDatabaseShape,
	Text extends string,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Db extends JsqlDatabaseShape
	? ApplyParsedStatements<ParseSqlTokens<Text>, Db, Params> extends [
			infer _Rest extends TokensList,
			infer NewDB extends JsqlDatabaseShape,
			infer Error extends SqlParserError<string> | null,
		]
		? [NewDB, Error]
		: never
	: [Db, null]

export type ApplyParsedStatements<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	Error extends SqlParserError<string> | null = null,
	Depth extends number = 0,
> = Depth extends 50 // Абмежаванне глыбіні
	? [Tokens, Db, Error]
	: PeekToken<Tokens> extends TokenEot
		? [Tokens, Db, Error]
		: ParseSqlStatement<Tokens, Db, Params> extends [
					infer Rest extends TokensList,
					infer NewDB extends JsqlDatabaseShape,
					infer Result,
			  ]
			? Result extends SqlParserError<string>
				? ApplyParsedStatementsAfterError<Rest, Db, Params, Error, Result, Depth>
				: ApplyParsedStatements<Rest, NewDB, Params, Error, Inc[Depth]>
			: never

type ApplyParsedStatementsAfterError<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Error extends SqlParserError<string> | null,
	Result extends SqlParserError<string>,
	Depth extends number,
> =
	ParseSkipStatement<Tokens, Db> extends [infer Rest2 extends TokensList, unknown, unknown]
		? Error extends null
			? ApplyParsedStatements<Rest2, Db, Params, Result, Inc[Depth]>
			: ApplyParsedStatements<Rest2, Db, Params, Error, Inc[Depth]>
		: never

export type ParseSqlStatement<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends TokenEot
		? [Tokens, Db, null]
		: PeekToken<Tokens> extends TokenKey<"alter">
			? ParseAlter<SkipToken<Tokens>, Db>
			: PeekToken<Tokens> extends TokenKey<"create">
				? ParseCreate<SkipToken<Tokens>, Db, Params>
				: PeekToken<Tokens> extends TokenKey<"drop">
					? ParseDrop<SkipToken<Tokens>, Db>
					: PeekToken<Tokens> extends TokenKey<"delete">
						? ParseDelete<SkipToken<Tokens>, Db, Params>
						: PeekToken<Tokens> extends TokenKey<"insert">
							? ParseInsert<SkipToken<Tokens>, Db, Params>
							: PeekToken<Tokens> extends TokenIdent<"with">
								? ParseSelect<Tokens, Db, Params>
								: PeekToken<Tokens> extends TokenKey<"select">
									? ParseSelect<SkipToken<Tokens>, Db, Params>
									: PeekToken<Tokens> extends TokenKey<"update">
										? ParseUpdate<SkipToken<Tokens>, Db, Params>
										: ParseSkipStatement<Tokens, Db>

type ConcatErrors<Errors extends SqlParserError<string> | null, Result extends SqlParserError<string> | null> =
	Errors extends SqlParserError<infer ErrorsMsg>
		? Result extends SqlParserError<infer ResultMsg>
			? SqlParserError<`${ErrorsMsg}; ${ResultMsg}`>
			: Errors
		: Result

type ParseAlter<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"table">
		? ParseAlterTable<Tokens, Db>
		: PeekToken<Tokens> extends TokenKey<"type">
			? ParseAlterType<SkipToken<Tokens>, Db>
			: ParseSkipStatement<Tokens, Db>

type ParseCreate<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends TokenKey<"table">
		? ParseCreateTable<SkipToken<Tokens>, Db>
		: PeekToken<Tokens> extends TokenKey<"schema">
			? ParseCreateSchema<SkipToken<Tokens>, Db>
			: PeekToken<Tokens> extends TokenKey<"type">
				? ParseCreateType<SkipToken<Tokens>, Db>
				: PeekToken<Tokens> extends TokenKey<"view">
					? ParseCreateView<SkipToken<Tokens>, Db, Params>
					: ParseSkipStatement<Tokens, Db>

type ParseDrop<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"table">
		? ParseDropTable<SkipToken<Tokens>, Db>
		: PeekToken<Tokens> extends TokenKey<"schema">
			? ParseDropSchema<SkipToken<Tokens>, Db>
			: PeekToken<Tokens> extends TokenKey<"type">
				? ParseDropType<SkipToken<Tokens>, Db>
				: ParseSkipStatement<Tokens, Db>
