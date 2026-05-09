import type {
	PeekToken,
	SkipToken,
	TokensList,
	TokenEot,
	TokenIdent,
	TokenKey,
	ParseSqlTokens,
} from "../lexer/sql-tokens.ts"
import type { SqlParserError as _SqlParserError, DbtyperError } from "../sql-parser-error.ts"
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
import type { ParseSelectStatement } from "./parse-select.ts"
import type { ParseUpdate } from "./parse-update.ts"
import type { ParseSkipStatement } from "./skip-statement.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "./parse-expression.ts"
import type { Inc } from "../core/type-utils.ts"

export type ApplyStatements<
	Db extends JsqlDatabaseShape,
	Text extends string,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Db extends JsqlDatabaseShape
	? ApplyParsedStatements<ParseSqlTokens<Text>, Db, Params, null> extends [
			infer _Rest extends TokensList,
			infer NewDB extends JsqlDatabaseShape,
			infer Error extends DbtyperError<any, any> | DbtyperError<any, any> | null,
		]
		? [NewDB, Error]
		: never
	: [Db, null]

export type ApplyParsedStatements<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Error extends DbtyperError<any, any> | DbtyperError<any, any> | null,
	BatchDepth extends number = 0,
> = BatchDepth extends 50
	? [Tokens, Db, Error]
	: PeekToken<Tokens> extends TokenEot
		? [Tokens, Db, Error]
		: ApplyParsedStatementsInner<Tokens, Db, Params, Error> extends [
					infer Rest extends TokensList,
					infer NewDB extends JsqlDatabaseShape,
					infer NewError extends DbtyperError<any, any> | DbtyperError<any, any> | null,
			  ]
			? ApplyParsedStatements<Rest, NewDB, Params, NewError, Inc[BatchDepth]>
			: never

type ApplyParsedStatementsInner<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Error extends DbtyperError<any, any> | DbtyperError<any, any> | null,
	Depth extends number = 0,
> = Depth extends 50
	? [Tokens, Db, Error]
	: PeekToken<Tokens> extends TokenEot
		? [Tokens, Db, Error]
		: ParseSqlStatement<Tokens, Db, Params> extends [
					infer Rest extends TokensList,
					infer NewDb extends JsqlDatabaseShape,
					infer Result,
			  ]
			? ApplyParsedStatementsInner<
					Rest,
					NewDb,
					Params,
					Result extends DbtyperError<any, any>
						? ConcatErrors<Error, Result>
						: Result extends DbtyperError<any, any>
							? ConcatErrors<Error, Result>
							: Error,
					Inc[Depth]
				>
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
								? ParseSelectStatement<Tokens, Db, Params>
								: PeekToken<Tokens> extends TokenKey<"select">
									? ParseSelectStatement<SkipToken<Tokens>, Db, Params>
									: PeekToken<Tokens> extends TokenKey<"update">
										? ParseUpdate<SkipToken<Tokens>, Db, Params>
										: ParseSkipStatement<Tokens, Db>

type ConcatErrors<
	Errors extends DbtyperError<any, any> | DbtyperError<any, any> | null,
	Result extends DbtyperError<any, any> | DbtyperError<any, any>,
> = Errors extends DbtyperError<any, any> | DbtyperError<any, any> ? Errors : Result

// Errors extends SqlParserError<infer ErrorsMsg>
// 		? Result extends SqlParserError<infer ResultMsg>
// 			? SqlParserError<`${ErrorsMsg}; ${ResultMsg}`>
// 			: Errors
// 		: Result

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
