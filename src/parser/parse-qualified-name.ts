import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot, TokenIdent, AsIdent, TokenKey, TokenType, TokenKind } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { UnqualifiedSchema } from "../core/jsql-utils.ts"
import type { SkipFailedQualifiedName } from "./skip-statement.ts"

/**
 * One row per place that reads `[schema.]name` (#175, "one name parser"): which errors it gives and which token may
 * follow the name. The statement parsers keep their own rows; the reading of the name is {@link ParseNameParts}.
 * - `name`, `afterDot`: no name where one is expected, and none after `schema.`.
 * - `ends`: the tokens that may follow the name (`never`: not checked). Then, if the name is not followed by one of
 *   them, `plain` is the error for an unqualified name that is not followed by `.` either, `qualified` the error for
 *   `schema.name` (`null`: not checked).
 * - `home`: the schema of an unqualified name: the database's default schema, the schema it is found in
 *   (`UnqualifiedSchema`: SQLite's `temp` first), or `null` (the caller looks it up).
 * - `skip`: after an error the rest of the statement is skipped (`SkipFailedQualifiedName`); else the rest starts at
 *   the token that was not as expected (never past a `;`, which would swallow the next statement).
 */
type NameRow = {
	name: DbtyperErrorShape
	afterDot: DbtyperErrorShape
	ends: TokenType<TokenKind, string>
	plain: DbtyperErrorShape | null
	qualified: DbtyperErrorShape | null
	skip: boolean
	home: "default" | "lookup" | "none"
}

type NameFailed<Rest extends ParserMonad, Row extends NameRow, Err extends DbtyperErrorShape> = Row["skip"] extends true
	? SkipFailedQualifiedName<Rest, Err>
	: [Rest, Err, never, never]

/** The schema of an unqualified name (`home`, see {@link NameRow}). */
type HomeSchema<Db extends JsqlDatabaseShape, Row extends NameRow, Name extends string> = Row["home"] extends "default"
	? Db["defaultSchema"]
	: Row["home"] extends "lookup"
		? UnqualifiedSchema<Db, Name>
		: null

/** After `schema.name`. */
type NameAfterSecond<AfterB extends ParserMonad, Row extends NameRow, A extends string, B extends string> =
	PeekToken<AfterB> extends Row["ends"]
		? [AfterB, null, A, B]
		: Row["qualified"] extends infer Q extends DbtyperErrorShape
			? NameFailed<AfterB, Row, Q>
			: [AfterB, null, A, B]

/** After `schema.`. */
type NameAfterDot<AfterDot extends ParserMonad, Row extends NameRow, A extends string> =
	AsIdent<PeekToken<AfterDot>> extends TokenIdent<infer B extends string>
		? NameAfterSecond<SkipToken<AfterDot>, Row, A, B>
		: NameFailed<AfterDot, Row, Row["afterDot"]>

/** After the first identifier (a name or a schema). */
type NameAfterFirst<
	AfterFirst extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Row extends NameRow,
	A extends string,
> =
	PeekToken<AfterFirst> extends Row["ends"]
		? [AfterFirst, null, HomeSchema<Db, Row, A>, A]
		: PeekToken<AfterFirst> extends TokenKey<".">
			? NameAfterDot<SkipToken<AfterFirst>, Row, A>
			: Row["plain"] extends infer P extends DbtyperErrorShape
				? NameFailed<AfterFirst, Row, P>
				: [AfterFirst, null, HomeSchema<Db, Row, A>, A]

/**
 * The one reader of `[schema.]name`: `[rest, null, schema, name]`, or `[rest, error, never, never]`. An unqualified
 * name gets the schema `Row["home"]` says (`null` for "none": the caller decides).
 */
export type ParseNameParts<Tokens extends ParserMonad, Db extends JsqlDatabaseShape, Row extends NameRow> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<infer A extends string>
		? NameAfterFirst<SkipToken<Tokens>, Db, Row, A>
		: NameFailed<Tokens, Row, Row["name"]>

type QualifiedNameRow = {
	name: FormatError<Errors["EXPECTED_NAME"], []>
	afterDot: FormatError<Errors["EXPECTED_NAME_AFTER_DOT_IN_QUALIFIED_NAME"], []>
	ends: TokenKey<"as"> | TokenKey<"add"> | TokenKey<";"> | TokenEot
	plain: FormatError<Errors["EXPECTED_DOT_OR_KEYWORD_AFTER_NAME"], []>
	qualified: null
	skip: true
	home: "default"
}

/** `[rest, null, schema, name]` on success; `[rest, error, never, never]` on parse failure. */
export type ParseQualifiedName<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> = ParseNameParts<
	Tokens,
	Db,
	QualifiedNameRow
>
