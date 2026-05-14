import type { PeekToken, SkipToken, CreateParserMonad } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { LexerFeatures } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape } from "../dbtyper-error.ts"
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
	Syntax extends LexerFeatures = "",
> =
	ApplyParsedStatements<CreateParserMonad<Text, Syntax>, Db, Params, null, null> extends [
		infer _Rest extends ParserMonad,
		infer NewDB extends JsqlDatabaseShape,
		infer Error extends DbtyperErrorShape | null,
		infer Result,
	]
		? [
				NewDB,
				Error,
				Result extends { returning: unknown }
					? [keyof Result["returning"]] extends [never]
						? { returning: null }
						: { returning: { [K in keyof Result["returning"]]: Result["returning"][K] } }
					: { returning: null },
			]
		: never

type ApplyParsedStatements<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Error extends DbtyperErrorShape | null,
	Result,
	BatchDepth extends number = 0,
> = BatchDepth extends 50
	? [Tokens, Db, Error, Result]
	: PeekToken<Tokens> extends TokenEot
		? [Tokens, Db, Error, Result]
		: ApplyParsedStatementsInner<Tokens, Db, Params, Error, Result> extends [
					infer Rest extends ParserMonad,
					infer NewDb extends JsqlDatabaseShape,
					infer NewError extends DbtyperErrorShape | null,
					infer NewResult,
			  ]
			? ApplyParsedStatements<Rest, NewDb, Params, NewError, NewResult, Inc[BatchDepth]>
			: never

type ApplyParsedStatementsInner<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Error extends DbtyperErrorShape | null,
	Result,
	Depth extends number = 0,
> = Depth extends 50
	? [Tokens, Db, Error, Result]
	: PeekToken<Tokens> extends TokenEot
		? [Tokens, Db, Error, Result]
		: ParseSqlStatement<Tokens, Db, Params> extends [
					infer Rest extends ParserMonad,
					infer NewDB extends JsqlDatabaseShape,
					infer NewResult,
			  ]
			? ApplyParsedStatementsInner<
					Rest,
					NewDB,
					Params,
					NewResult extends DbtyperErrorShape ? ConcatErrors<Error, NewResult> : Error,
					NewResult extends DbtyperErrorShape ? null : NewResult,
					Inc[Depth]
				>
			: never

export type ParseSqlStatement<
	Tokens extends ParserMonad,
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
	Errors extends DbtyperErrorShape | null,
	Result extends DbtyperErrorShape,
> = Errors extends DbtyperErrorShape ? Errors : Result

type ParseAlter<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"table">
		? ParseAlterTable<Tokens, Db>
		: PeekToken<Tokens> extends TokenKey<"type">
			? ParseAlterType<SkipToken<Tokens>, Db>
			: ParseSkipStatement<Tokens, Db>

type ParseCreate<
	Tokens extends ParserMonad,
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

type ParseDrop<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"table">
		? ParseDropTable<SkipToken<Tokens>, Db>
		: PeekToken<Tokens> extends TokenKey<"schema">
			? ParseDropSchema<SkipToken<Tokens>, Db>
			: PeekToken<Tokens> extends TokenKey<"type">
				? ParseDropType<SkipToken<Tokens>, Db>
				: ParseSkipStatement<Tokens, Db>
