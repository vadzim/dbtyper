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
import type { ParseCreateDomain } from "./parse-create-domain.ts"
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
import type {
	PostgresSkippedStatementKeywords,
	SqliteSkippedStatementKeywords,
	UnknownStatementError,
} from "./statement-keywords.ts"

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

/**
 * Two nested loops of 50 (BatchDepth outside, Depth inside) apply at most 2,500 statements per script. One
 * recursion over all statements ends in "Type instantiation is excessively deep" (commit 438cd53, #48), so the
 * loop is cut into batches; the 50 is TypeScript's instantiation depth in practice, not a rule of the product.
 * A longer script gets TOO_MANY_STATEMENTS (STMT-16).
 */
type ApplyParsedStatements<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Error extends DbtyperErrorShape | null,
	Result,
	BatchDepth extends number = 0,
> =
	PeekToken<Tokens> extends TokenEot
		? [Tokens, Db, Error, Result]
		: // TLVL-4: 50 batches of 50 statements dodge the instantiation depth limit (TS2589, "excessively deep"); found
			// by test/stress/migration-500-statements and migration-too-many-statements (2501 statements, STMT-16).
			BatchDepth extends 50
			? // STMT-16: the script is too long to apply; say so instead of dropping the tail.
				[Tokens, Db, ConcatErrors<Error, FormatError<Errors["TOO_MANY_STATEMENTS"], []>>, Result]
			: ApplyParsedStatementsInner<Tokens, Db, Params, Error, Result> extends [
						infer Rest extends ParserMonad,
						infer NewDb extends JsqlDatabaseShape,
						infer NewError extends DbtyperErrorShape | null,
						infer NewResult,
				  ]
				? ApplyParsedStatements<Rest, NewDb, Params, NewError, NewResult, Inc<BatchDepth>>
				: never

/**
 * TLVL-4: the `Depth extends 50` bound below (50 statements per batch) dodges the instantiation depth limit (TS2589);
 * the outer loop runs 50 such batches (test/stress/migration-500-statements, migration-too-many-statements, STMT-16).
 */
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

/**
 * A statement no parser handles (STMT-18, STMT-19): a known statement keyword is skipped (but ATTACH / DETACH are
 * errors in a SQLite chain, SQLT-24); any other leading word is a compile error with a hint (never skipped silently).
 */
type ParseOtherStatement<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	DialectFact<Db, "ddl"> extends true
		? PeekToken<Tokens> extends TokenIdent<"attach" | "detach">
			? SkipFailedStatement<
					Tokens,
					Db,
					FormatError<Errors["SQLITE_UNSUPPORTED_STATEMENT"], [Uppercase<PeekToken<Tokens>["value"]>]>
				>
			: SkipKnownOrFail<Tokens, Db, SqliteSkippedStatementKeywords>
		: SkipKnownOrFail<Tokens, Db, PostgresSkippedStatementKeywords>

type SkipKnownOrFail<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Known extends readonly string[],
> =
	PeekToken<Tokens> extends TokenKey<"("> | TokenEot
		? // `(select …)` and the like: a parenthesised query is not a keyword statement; stepped over as before
			ParseSkipStatement<Tokens, Db>
		: PeekToken<Tokens> extends { value: infer Word extends string }
			? Lowercase<Word> extends Known[number]
				? ParseSkipStatement<Tokens, Db>
				: SkipFailedStatement<Tokens, Db, UnknownStatementError<Word, Known>>
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
						: PeekToken<Tokens> extends TokenIdent<"domain"> | TokenKey<"domain">
							? ParseCreateDomain<SkipToken<Tokens>, Db>
							: ParsePgCreateView<Tokens, Db, Params>

/** PostgreSQL (PGT-20): `CREATE OR REPLACE VIEW`, `CREATE MATERIALIZED VIEW` (typed as a view); other statements are skipped. */
type ParsePgCreateView<Tokens extends ParserMonad, Db extends JsqlDatabaseShape, Params extends ExpressionParamsShape> =
	PeekToken<Tokens> extends TokenKey<"or">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"replace">
				? SkipToken<R1> extends infer R2 extends ParserMonad
					? PeekToken<R2> extends TokenKey<"view">
						? ParseCreateView<SkipToken<R2>, Db, Params, false, true>
						: ParseSkipStatement<R2, Db>
					: never
				: ParseSkipStatement<R1, Db>
			: never
		: PeekToken<Tokens> extends TokenIdent<"materialized">
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<"view">
					? ParseCreateView<SkipToken<R1>, Db, Params>
					: ParseSkipStatement<R1, Db>
				: never
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
					: PeekToken<Tokens> extends TokenIdent<"materialized"> // PGT-20
						? SkipToken<Tokens> extends infer R1 extends ParserMonad
							? PeekToken<R1> extends TokenKey<"view">
								? ParseDropView<SkipToken<R1>, Db>
								: ParseSkipStatement<R1, Db>
							: never
						: ParseSkipStatement<Tokens, Db>
