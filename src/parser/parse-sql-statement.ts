import type { PeekToken, SkipToken, CreateParserMonad, TokenEotWithDialectError } from "../lexer/parser-monad.ts"
import type { DialectFact, ParserSyntax } from "../core/dialect.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
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
import type { ParseDropView } from "./parse-drop-view.ts"
import type { ParseInsert } from "./parse-insert.ts"
import type { ParseSelectStatement } from "./parse-select.ts"
import type { ParseUpdate } from "./parse-update.ts"
import type { ParseSkipStatement, ParseSkipTrigger, SkipFailedStatement } from "./skip-statement.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "./parse-expression.ts"
import type { Inc } from "../core/type-utils.ts"

export type ApplyStatements<
	Db extends JsqlDatabaseShape,
	Text extends string,
	Params extends ExpressionParamsShape | null = null,
	Syntax extends ParserSyntax = "",
> =
	ApplyParsedStatements<
		CreateParserMonad<Text, Syntax>,
		Db,
		Params extends null ? EmptyExpressionParams : Params,
		null,
		null
	> extends [
		infer Rest extends ParserMonad,
		infer NewDB extends JsqlDatabaseShape,
		infer Error extends DbtyperErrorShape | null,
		infer Result,
	]
		? [
				NewDB,
				// DSEL-5, DSEL-6: other-dialect syntax the lexer met is the root cause; it wins over parser errors.
				PeekToken<Rest> extends TokenEotWithDialectError<infer DialectError> ? DialectError : Error,
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
			? ApplyParsedStatements<Rest, NewDb, Params, NewError, NewResult, Inc<BatchDepth>>
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
		: PeekToken<Tokens> extends TokenKey<";">
			? // STMT-8: an empty statement is ignored and does not replace the previous result
				ApplyParsedStatementsInner<SkipToken<Tokens>, Db, Params, Error, Result, Inc<Depth>>
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
						Inc<Depth>
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
										: PeekToken<Tokens> extends TokenKey<"replace">
											? // SQLT-39: `REPLACE INTO` is `INSERT OR REPLACE INTO`
												ParseInsert<SkipToken<Tokens>, Db, Params>
											: ParseOtherStatement<Tokens, Db>

/** A statement no parser knows: skipped; but ATTACH / DETACH are errors in a SQLite chain (SQLT-24). */
type ParseOtherStatement<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	DialectFact<Db, "ddl"> extends true
		? PeekToken<Tokens> extends TokenIdent<"attach" | "detach">
			? SkipFailedStatement<
					Tokens,
					Db,
					FormatError<Errors["SQLITE_UNSUPPORTED_STATEMENT"], [Uppercase<PeekToken<Tokens>["value"]>]>
				>
			: ParseSkipStatement<Tokens, Db>
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
		? ParseCreateTable<SkipToken<Tokens>, Db, Params>
		: PeekToken<Tokens> extends TokenKey<"schema">
			? DialectFact<Db, "ddl"> extends true
				? SkipFailedStatement<Tokens, Db, FormatError<Errors["SQLITE_NO_SCHEMAS"], []>>
				: ParseCreateSchema<SkipToken<Tokens>, Db>
			: PeekToken<Tokens> extends TokenKey<"type">
				? ParseCreateType<SkipToken<Tokens>, Db>
				: PeekToken<Tokens> extends TokenKey<"view">
					? ParseCreateView<SkipToken<Tokens>, Db, Params>
					: DialectFact<Db, "ddl"> extends true
						? ParseSqliteCreate<Tokens, Db, Params>
						: ParseSkipStatement<Tokens, Db>

/** SQLite: `CREATE [TEMP|TEMPORARY] TABLE|VIEW|TRIGGER`, `CREATE VIRTUAL TABLE`; the rest (INDEX…) is skipped (SQLT-22…SQLT-24). */
type ParseSqliteCreate<Tokens extends ParserMonad, Db extends JsqlDatabaseShape, Params extends ExpressionParamsShape> =
	PeekToken<Tokens> extends TokenIdent<"temp" | "temporary">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"table">
				? ParseCreateTable<SkipToken<R1>, Db, Params, true>
				: PeekToken<R1> extends TokenKey<"view">
					? ParseCreateView<SkipToken<R1>, Db, Params, true>
					: PeekToken<R1> extends TokenIdent<"trigger">
						? ParseSkipTrigger<SkipToken<R1>, Db>
						: ParseSkipStatement<R1, Db>
			: never
		: PeekToken<Tokens> extends TokenIdent<"trigger">
			? ParseSkipTrigger<SkipToken<Tokens>, Db>
			: PeekToken<Tokens> extends TokenKey<"virtual"> | TokenIdent<"virtual">
				? SkipFailedStatement<
						Tokens,
						Db,
						FormatError<Errors["SQLITE_UNSUPPORTED_STATEMENT"], ["CREATE VIRTUAL TABLE"]>
					>
				: ParseSkipStatement<Tokens, Db>

type ParseDrop<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"table">
		? ParseDropTable<SkipToken<Tokens>, Db>
		: PeekToken<Tokens> extends TokenKey<"schema">
			? DialectFact<Db, "ddl"> extends true
				? SkipFailedStatement<Tokens, Db, FormatError<Errors["SQLITE_NO_SCHEMAS"], []>>
				: ParseDropSchema<SkipToken<Tokens>, Db>
			: PeekToken<Tokens> extends TokenKey<"type">
				? ParseDropType<SkipToken<Tokens>, Db>
				: PeekToken<Tokens> extends TokenKey<"view">
					? ParseDropView<SkipToken<Tokens>, Db>
					: ParseSkipStatement<Tokens, Db>
