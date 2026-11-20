import type { PeekToken, SkipToken, CreateParserMonad, TokenEotWithDialectError } from "../lexer/parser-monad.ts"
import type { DialectFact, ParserSyntax, SingleStatementFlag } from "../core/dialect.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { ParseAlterTable } from "./parse-alter-table.ts"
import type { ParseAlterType } from "./parse-alter-type.ts"
import type { ParseCreateDomain } from "./parse-create-domain.ts"
import type { ParseCreateSchema } from "./parse-create-schema.ts"
import type { ParseCreateTable } from "./parse-create-table.ts"
import type { ParseCreateType } from "./parse-create-type.ts"
import type { ParseCreateView } from "./parse-create-view.ts"
import type { ParseDelete } from "./parse-delete.ts"
import type { ParseDropSchema } from "./parse-drop-schema.ts"
import type { ParseDropTable } from "./parse-drop.ts"
import type { ParseDropType } from "./parse-drop.ts"
import type { ParseDropView, ParseDropDomain } from "./parse-drop.ts"
import type { ParseInsert } from "./parse-insert.ts"
import type { ParseSelectStatement, ParseSetOperationTail } from "./parse-select.ts"
import type { ParseParenEnclosedSelect } from "./parse-select-subquery.ts"
import type { ParseUpdate } from "./parse-update.ts"
import type { ParseSkipStatement, ParseSkipTrigger, SkipBracketedUntil, SkipFailedStatement } from "./skip-statement.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "./parse-expression.ts"
import type { Inc } from "../core/type-utils.ts"
import type { RenameUntracked, StatementVerb, UnknownFormError, UnknownStatementError } from "./statement-keywords.ts"

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
		null,
		[Extract<Syntax, SingleStatementFlag>] extends [never] ? false : true
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
						? Result extends { ddl: true }
							? DdlMarker
							: { returning: null }
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
	Single extends boolean,
	BatchDepth extends number = 0,
> =
	PeekToken<Tokens> extends TokenEot
		? [Tokens, Db, Error, Result]
		: // TLVL-4: StatementBatches batches of StatementsPerBatch statements dodge the instantiation depth limit (TS2589,
			// "excessively deep"); found by test/stress/migration-500-statements and migration-too-many-statements
			// (2501 statements, STMT-16). TOO_MANY_STATEMENTS (src/dbtyper-error.ts) says the product of the two.
			BatchDepth extends StatementBatches
			? // STMT-16: the script is too long to apply; say so instead of dropping the tail.
				[Tokens, Db, ConcatErrors<Error, FormatError<Errors["TOO_MANY_STATEMENTS"], [MaxStatements]>>, Result]
			: ApplyParsedStatementsInner<Tokens, Db, Params, Error, Result, Single> extends [
						infer Rest extends ParserMonad,
						infer NewDb extends JsqlDatabaseShape,
						infer NewError extends DbtyperErrorShape | null,
						infer NewResult,
				  ]
				? ApplyParsedStatements<Rest, NewDb, Params, NewError, NewResult, Single, Inc<BatchDepth>>
				: never

/** TLVL-4: statements per batch, and batches per script: a script may have `StatementsPerBatch * StatementBatches` (2500) statements. */
type StatementsPerBatch = 50
type StatementBatches = 50
/** `StatementsPerBatch * StatementBatches`, for the message; test/stress/migration-too-many-statements (2501) breaks if the product changes. */
type MaxStatements = 2500

/**
 * TLVL-4: the `Depth extends StatementsPerBatch` bound below dodges the instantiation depth limit (TS2589);
 * the outer loop runs {@link StatementBatches} such batches (test/stress/migration-500-statements, migration-too-many-statements, STMT-16).
 */
type ApplyParsedStatementsInner<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Error extends DbtyperErrorShape | null,
	Result,
	Single extends boolean,
	Depth extends number = 0,
> = Depth extends StatementsPerBatch
	? [Tokens, Db, Error, Result]
	: PeekToken<Tokens> extends TokenEot
		? [Tokens, Db, Error, Result]
		: PeekToken<Tokens> extends TokenKey<";">
			? // STMT-8: an empty statement is ignored and does not replace the previous result
				ApplyParsedStatementsInner<SkipToken<Tokens>, Db, Params, Error, Result, Single, Inc<Depth>>
			: ParseSqlStatement<Tokens, Db, Params> extends [
						infer Rest extends ParserMonad,
						infer NewDB extends JsqlDatabaseShape,
						infer NewResult,
				  ]
				? ApplyParsedStatementsInner<
						Rest,
						NewDB,
						Params,
						NewResult extends DbtyperErrorShape
							? ConcatErrors<ErrorWithSecondStatement<Single, Error, Result>, NewResult>
							: ErrorWithSecondStatement<Single, Error, Result>,
						NewResult extends DbtyperErrorShape ? null : NewResult,
						Single,
						Inc<Depth>
					>
				: never

/**
 * STMT-22, #156: with the flag `single-statement` (a driver that runs only the first statement of a text) a statement
 * that follows another one is an error; the first error stays the reported one. A statement was parsed before when the
 * error or the result is set.
 */
type ErrorWithSecondStatement<
	Single extends boolean,
	Error extends DbtyperErrorShape | null,
	Result,
> = Single extends true
	? [Error, Result] extends [null, null]
		? Error
		: ConcatErrors<Error, FormatError<Errors["MULTIPLE_STATEMENTS_IN_QUERY"], []>>
	: Error

export type ParseSqlStatement<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends TokenEot
		? [Tokens, Db, null]
		: PeekToken<Tokens> extends TokenKey<"alter">
			? ParseAlter<SkipToken<Tokens>, Db> extends [
					infer R extends ParserMonad,
					infer D extends JsqlDatabaseShape,
					infer Res,
				]
				? AsDdlResult<R, D, Res>
				: never
			: PeekToken<Tokens> extends TokenKey<"create">
				? ParseCreate<SkipToken<Tokens>, Db, Params> extends [
						infer R extends ParserMonad,
						infer D extends JsqlDatabaseShape,
						infer Res,
					]
					? AsDdlResult<R, D, Res>
					: never
				: PeekToken<Tokens> extends TokenKey<"drop">
					? ParseDrop<SkipToken<Tokens>, Db> extends [
							infer R extends ParserMonad,
							infer D extends JsqlDatabaseShape,
							infer Res,
						]
						? AsDdlResult<R, D, Res>
						: never
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
											: PeekToken<Tokens> extends TokenKey<"(">
												? ParseParenthesizedQuery<SkipToken<Tokens>, Db, Params>
												: ParseOtherStatement<Tokens, Db> extends [
															infer R extends ParserMonad,
															infer D extends JsqlDatabaseShape,
															infer Res,
													  ]
													? AsDdlResult<R, D, Res>
													: never

/** #157: `(SELECT …) [UNION (SELECT …) …];` is typed like the query without the parentheses (`Tokens` after `(`). */
type ParseParenthesizedQuery<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
> =
	ParseParenEnclosedSelect<Tokens, Db, Params> extends [infer R1 extends ParserMonad, infer Res]
		? Res extends DbtyperErrorShape
			? [R1, Db, Res]
			: Res extends JsqlSelectStatementResult
				? ParseSetOperationTail<R1, Db, Res, Params, {}, {}, true> extends [
						infer R2 extends ParserMonad,
						infer _Db,
						infer Res2,
					]
					? Res2 extends DbtyperErrorShape
						? [R2, Db, Res2]
						: PeekToken<R2> extends TokenKey<";"> | TokenEot
							? [SkipToken<R2>, Db, Res2]
							: SkipFailedStatement<R2, Db, FormatError<Errors["EXPECTED_SEMICOLON"], ["SELECT"]>>
					: never
				: never
		: never

/** The result of a statement that returns no rows and no row list (DDL, skipped statements). */
type DdlMarker = { returning: null; ddl: true }

/**
 * SCHEMA-6, STMT-Q5: DDL and skipped statements return no rows and no row list: a `query` of one is `unknown`, unlike
 * INSERT/UPDATE/DELETE without RETURNING (CORE-13, `[]`). A successful result is replaced by the marker `{ ddl: true }`.
 */
type AsDdlResult<Rest extends ParserMonad, Db extends JsqlDatabaseShape, Result> = Result extends DbtyperErrorShape
	? [Rest, Db, Result]
	: [Rest, Db, DdlMarker]

/**
 * A statement no parser handles (STMT-18, STMT-19): a known statement keyword is skipped (but the words of the
 * `unsupportedStatements` fact, ATTACH / DETACH in SQLite, are errors, SQLT-24); any other leading word is a compile error with a hint (never skipped silently).
 */
type ParseOtherStatement<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends { value: infer Word extends string }
		? Lowercase<Word> extends DialectFact<Db, "unsupportedStatements">[number]
			? SkipFailedStatement<Tokens, Db, FormatError<Errors["SQLITE_UNSUPPORTED_STATEMENT"], [Uppercase<Word>]>>
			: SkipKnownOrFail<Tokens, Db, DialectFact<Db, "skippedStatements">>
		: SkipKnownOrFail<Tokens, Db, DialectFact<Db, "skippedStatements">>

type SkipKnownOrFail<Tokens extends ParserMonad, Db extends JsqlDatabaseShape, Known extends readonly string[]> =
	PeekToken<Tokens> extends TokenEot
		? ParseSkipStatement<Tokens, Db>
		: PeekToken<Tokens> extends { value: infer Word extends string }
			? Lowercase<Word> extends Known[number]
				? ParseSkipStatement<Tokens, Db>
				: SkipFailedStatement<Tokens, Db, UnknownStatementError<Word, Known>>
			: ParseSkipStatement<Tokens, Db>

type ConcatErrors<
	Errors extends DbtyperErrorShape | null,
	Result extends DbtyperErrorShape,
> = Errors extends DbtyperErrorShape ? Errors : Result

/**
 * The second word of CREATE / ALTER / DROP (#158): a parsed form, a skipped form of the dialect (`skippedForms`), or an
 * error. `Tokens` is at the second word.
 */
type SkipStatementForm<Tokens extends ParserMonad, Db extends JsqlDatabaseShape, Verb extends StatementVerb> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_STATEMENT_FORM"], [Uppercase<Verb>]>>
		: PeekToken<Tokens> extends { value: infer Word extends string }
			? Lowercase<Word> extends DialectFact<Db, "skippedForms">[Verb][number]
				? Verb extends "alter"
					? Lowercase<Word> extends keyof RenameUntracked
						? SkipAlterUnlessRename<SkipToken<Tokens>, Db, Lowercase<Word>>
						: ParseSkipStatement<Tokens, Db>
					: ParseSkipStatement<Tokens, Db>
				: SkipFailedStatement<Tokens, Db, UnknownFormError<Verb, Word, DialectFact<Db, "skippedForms">[Verb]>>
			: ParseSkipStatement<Tokens, Db>

/** STMT-Q2: `ALTER VIEW | MATERIALIZED VIEW | SCHEMA … RENAME …` would leave the typed schema behind: an error. */
type SkipAlterUnlessRename<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Word extends keyof RenameUntracked,
> =
	SkipBracketedUntil<Tokens, TokenKey<"rename" | ";"> | TokenEot> extends [infer R extends ParserMonad, infer Res]
		? Res extends DbtyperErrorShape
			? [SkipToken<R>, Db, Res]
			: PeekToken<R> extends TokenKey<"rename">
				? SkipFailedStatement<
						R,
						Db,
						FormatError<
							Errors["UNTRACKED_SCHEMA_CHANGE"],
							[
								`ALTER ${Word extends "materialized" ? "MATERIALIZED VIEW" : Uppercase<Word>} … RENAME`,
								RenameUntracked[Word],
							]
						>
					>
				: [SkipToken<R>, Db, Res]
		: never

type ParseAlter<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"table">
		? ParseAlterTable<Tokens, Db>
		: PeekToken<Tokens> extends TokenKey<"type">
			? ParseAlterType<SkipToken<Tokens>, Db>
			: SkipStatementForm<Tokens, Db, "alter">

/**
 * CREATE forms. One-dialect forms need no condition here: the phrase table (src/core/dialect-constructs.ts) reports
 * `CREATE OR REPLACE`, `MATERIALIZED`, `UNLOGGED`, `DOMAIN` in a SQLite chain (DSEL-5), and they are parsed as in
 * PostgreSQL. Only TEMP reads a fact (`tempObjects`, SQLT-23, SQLT-25).
 */
type ParseCreate<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends TokenKey<"table">
		? ParseCreateTable<SkipToken<Tokens>, Db, Params>
		: PeekToken<Tokens> extends TokenKey<"schema">
			? // CREATE SCHEMA of a chain without schemas is the other-dialect error of the phrase table (1900, SQLT-26)
				ParseCreateSchema<SkipToken<Tokens>, Db>
			: PeekToken<Tokens> extends TokenKey<"type">
				? ParseCreateType<SkipToken<Tokens>, Db>
				: PeekToken<Tokens> extends TokenKey<"view">
					? ParseCreateView<SkipToken<Tokens>, Db, Params>
					: PeekToken<Tokens> extends TokenIdent<"domain"> | TokenKey<"domain">
						? ParseCreateDomain<SkipToken<Tokens>, Db>
						: PeekToken<Tokens> extends TokenIdent<"temp" | "temporary">
							? ParseCreateTemp<SkipToken<Tokens>, Db, Params>
							: PeekToken<Tokens> extends TokenIdent<"trigger">
								? // `CREATE TRIGGER … BEGIN … END` (SQLT-23) is one statement; without BEGIN it ends at `;`
									ParseSkipTrigger<SkipToken<Tokens>, Db>
								: PeekToken<Tokens> extends TokenKey<"virtual"> | TokenIdent<"virtual">
									? SkipFailedStatement<
											Tokens,
											Db,
											FormatError<
												Errors["SQLITE_UNSUPPORTED_STATEMENT"],
												["CREATE VIRTUAL TABLE"]
											>
										>
									: ParseCreateNamedForm<Tokens, Db, Params>

/** PGT-20: `CREATE OR REPLACE VIEW`, `CREATE MATERIALIZED VIEW` (typed as a view), `CREATE UNLOGGED TABLE`. */
type ParseCreateNamedForm<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"or">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"replace">
				? SkipToken<R1> extends infer R2 extends ParserMonad
					? PeekToken<R2> extends TokenKey<"view">
						? ParseCreateView<SkipToken<R2>, Db, Params, false, true>
						: PeekToken<R2> extends TokenIdent<"trigger">
							? ParseSkipTrigger<SkipToken<R2>, Db>
							: SkipStatementForm<R2, Db, "create">
					: never
				: SkipStatementForm<Tokens, Db, "create">
			: never
		: PeekToken<Tokens> extends TokenIdent<"materialized">
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<"view">
					? ParseCreateView<SkipToken<R1>, Db, Params>
					: SkipStatementForm<Tokens, Db, "create">
				: never
			: PeekToken<Tokens> extends TokenIdent<"unlogged">
				? SkipToken<Tokens> extends infer R1 extends ParserMonad
					? PeekToken<R1> extends TokenKey<"table">
						? ParseCreateTable<SkipToken<R1>, Db, Params>
						: SkipStatementForm<Tokens, Db, "create">
					: never
				: SkipStatementForm<Tokens, Db, "create">

/** `CREATE TEMP|TEMPORARY TABLE|VIEW|TRIGGER` where temp objects are typed (`tempObjects`), else an error (STMT-Q2). */
type ParseCreateTemp<Tokens extends ParserMonad, Db extends JsqlDatabaseShape, Params extends ExpressionParamsShape> =
	DialectFact<Db, "tempObjects"> extends true
		? PeekToken<Tokens> extends TokenKey<"table">
			? ParseCreateTable<SkipToken<Tokens>, Db, Params, true>
			: PeekToken<Tokens> extends TokenKey<"view">
				? ParseCreateView<SkipToken<Tokens>, Db, Params, true>
				: PeekToken<Tokens> extends TokenIdent<"trigger">
					? ParseSkipTrigger<SkipToken<Tokens>, Db>
					: SkipStatementForm<Tokens, Db, "create">
		: SkipFailedStatement<
				Tokens,
				Db,
				FormatError<
					Errors["UNTRACKED_SCHEMA_CHANGE"],
					["CREATE TEMP", "Create a regular table, or run it with queryUntyped outside the migrations"]
				>
			>

type ParseDrop<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"table">
		? ParseDropTable<SkipToken<Tokens>, Db>
		: PeekToken<Tokens> extends TokenKey<"schema">
			? DialectFact<Db, "schemaStatements"> extends true
				? ParseDropSchema<SkipToken<Tokens>, Db>
				: SkipFailedStatement<Tokens, Db, FormatError<Errors["SQLITE_NO_SCHEMAS"], []>>
			: PeekToken<Tokens> extends TokenKey<"type">
				? ParseDropType<SkipToken<Tokens>, Db>
				: PeekToken<Tokens> extends TokenKey<"view">
					? ParseDropView<SkipToken<Tokens>, Db>
					: PeekToken<Tokens> extends TokenIdent<"domain"> | TokenKey<"domain">
						? ParseDropDomain<SkipToken<Tokens>, Db>
						: PeekToken<Tokens> extends TokenIdent<"materialized"> // PGT-20
							? SkipToken<Tokens> extends infer R1 extends ParserMonad
								? PeekToken<R1> extends TokenKey<"view">
									? ParseDropView<SkipToken<R1>, Db>
									: SkipStatementForm<Tokens, Db, "drop">
								: never
							: SkipStatementForm<Tokens, Db, "drop">
