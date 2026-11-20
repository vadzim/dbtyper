import type { DbDialectOnlyError, DialectFact } from "../core/dialect.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { ParserMonad, PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { AsIdent, TokenIdent, TokenKey, TokenKind, TokenType } from "../lexer/sql-lexer.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"

/**
 * One row per place that reads `[AS] alias` (#175, "one alias parser"): FROM and JOIN items, CTE and derived-table
 * aliases, and the target table of INSERT, UPDATE and DELETE. The reading is {@link ParseAlias}; a place is data:
 * - `ends`: a bare token that means "no alias" (not looked at after `AS`).
 * - `bare`: "allowed" = `t alias` is fine; "never" = only `t AS alias` (INSERT); "dml" = the `bareDmlAlias` fact
 *   decides (SQLite UPDATE and DELETE targets need AS: 1309, which names `verb`).
 * - `afterAs`: the error when no name follows `AS` (also for a bare alias where `bare` is "never").
 * - `bad`: the error for a bare token that is no name (`null`: it is not an alias and stays unread).
 * - `tail`, `tailError`: the tokens that must follow an alias, and the error if they do not (`never`, `null`: not
 *   checked).
 * An error leaves the rest at the token that was not as expected, so a `;` is never swallowed.
 */
type AliasRow = {
	ends: TokenType<TokenKind, string>
	bare: "allowed" | "never" | "dml"
	verb: string
	afterAs: DbtyperErrorShape
	bad: DbtyperErrorShape | null
	tail: TokenType<TokenKind, string>
	tailError: DbtyperErrorShape | null
}

/**
 * SQLT-73 (#206): SQLite's `INDEXED BY name` / `NOT INDEXED` after a table of FROM, UPDATE or DELETE and its alias. The
 * place passes the table's index names (`IndexNamesOf`, src/parser/parse-index.ts); `null`: no index hint is read here.
 * No typing effect; the index must be one of the table's (2221). Another dialect: the other-dialect error.
 */
type IndexHint = { table: string; indexes: string }

/**
 * The index hint after its first word, `Word` "indexed" (then `BY name`) or "not" (then `INDEXED`); `Alias` is the
 * alias read before it (`null`: none). Then the tail of the alias. A first word without its second is the row's `bad`
 * error.
 */
type ParseIndexHint<
	AfterWord extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Row extends AliasRow,
	Hint extends IndexHint,
	Alias extends string | null,
	Word extends "indexed" | "not",
> =
	PeekToken<AfterWord> extends (Word extends "not" ? TokenIdent<"indexed"> : TokenKey<"by">)
		? DbDialectOnlyError<Db, "sqlite-indexed-by"> extends infer E extends DbtyperErrorShape
			? [AfterWord, E, ParserRefErrorThirdSentinel]
			: SkipToken<AfterWord> extends infer R extends ParserMonad
				? Word extends "not"
					? AliasTailCheck<R, Row, Alias>
					: IndexHintName<R, Row, Hint, Alias>
				: never
		: [AfterWord, NonNullable<Row["bad"]>, ParserRefErrorThirdSentinel]

/** After `INDEXED BY`: the index, one of the table's (2221). */
type IndexHintName<
	AfterBy extends ParserMonad,
	Row extends AliasRow,
	Hint extends IndexHint,
	Alias extends string | null,
> =
	AsIdent<PeekToken<AfterBy>> extends TokenIdent<infer Name extends string>
		? Name extends Hint["indexes"]
			? AliasTailCheck<SkipToken<AfterBy>, Row, Alias>
			: [AfterBy, FormatError<Errors["UNKNOWN_INDEX"], [Name, Hint["table"]]>, ParserRefErrorThirdSentinel]
		: [AfterBy, FormatError<Errors["EXPECTED_INDEX_NAME_AFTER_INDEXED_BY"], []>, ParserRefErrorThirdSentinel]

/** After the alias name: an index hint where the place reads one, then the tokens that must follow. */
type AliasTail<
	AfterAlias extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Row extends AliasRow,
	Alias extends string,
	Hint extends IndexHint | null,
> = Hint extends IndexHint
	? PeekToken<AfterAlias> extends TokenIdent<"indexed">
		? ParseIndexHint<SkipToken<AfterAlias>, Db, Row, Hint, Alias, "indexed">
		: PeekToken<AfterAlias> extends TokenKey<"not">
			? ParseIndexHint<SkipToken<AfterAlias>, Db, Row, Hint, Alias, "not">
			: AliasTailCheck<AfterAlias, Row, Alias>
	: AliasTailCheck<AfterAlias, Row, Alias>

/** The tokens that must follow the alias (or the table, `Alias` null). */
type AliasTailCheck<AfterAlias extends ParserMonad, Row extends AliasRow, Alias extends string | null> =
	PeekToken<AfterAlias> extends Row["tail"]
		? [AfterAlias, null, Alias]
		: Row["tailError"] extends infer E extends DbtyperErrorShape
			? [AfterAlias, E, ParserRefErrorThirdSentinel]
			: [AfterAlias, null, Alias]

/** After `AS`. */
type AliasAfterAs<
	AfterAs extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Row extends AliasRow,
	Hint extends IndexHint | null,
> =
	AsIdent<PeekToken<AfterAs>> extends TokenIdent<infer Alias extends string>
		? AliasTail<SkipToken<AfterAs>, Db, Row, Alias, Hint>
		: [AfterAs, Row["afterAs"], ParserRefErrorThirdSentinel]

/** The bare token was a name (`AfterName` is after it); may a bare alias be written here? */
type AliasBareName<
	AfterName extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Row extends AliasRow,
	Alias extends string,
	Hint extends IndexHint | null,
> = Row["bare"] extends "allowed"
	? AliasTail<AfterName, Db, Row, Alias, Hint>
	: Row["bare"] extends "dml"
		? DialectFact<Db, "bareDmlAlias"> extends true
			? AliasTail<AfterName, Db, Row, Alias, Hint>
			: [
					AfterName,
					FormatError<Errors["BARE_DML_ALIAS_NEEDS_AS"], [Row["verb"], Alias]>,
					ParserRefErrorThirdSentinel,
				]
		: [AfterName, Row["afterAs"], ParserRefErrorThirdSentinel]

/**
 * The one reader of `[AS] alias`: `[rest, null, alias]`, `[rest, null, null]` (no alias: the table keeps its name),
 * or `[rest, error, ParserRefErrorThirdSentinel]`. `Hint`: the place reads an index hint ({@link IndexHint}); there a
 * bare `indexed` followed by `BY` starts the hint, not an alias.
 */
export type ParseAlias<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Row extends AliasRow,
	Hint extends IndexHint | null = null,
> =
	PeekToken<Tokens> extends TokenKey<"as">
		? AliasAfterAs<SkipToken<Tokens>, Db, Row, Hint>
		: PeekToken<Tokens> extends Row["ends"]
			? [Tokens, null, null]
			: [Hint, PeekToken<Tokens>] extends [IndexHint, TokenKey<"not">]
				? ParseIndexHint<SkipToken<Tokens>, Db, Row, Hint & IndexHint, null, "not">
				: AsIdent<PeekToken<Tokens>> extends TokenIdent<infer Alias extends string>
					? SkipToken<Tokens> extends infer R1 extends ParserMonad
						? [Hint, Alias, PeekToken<R1>] extends [IndexHint, "indexed", TokenKey<"by">]
							? ParseIndexHint<R1, Db, Row, Hint & IndexHint, null, "indexed">
							: AliasBareName<R1, Db, Row, Alias, Hint>
						: never
					: Row["bad"] extends infer E extends DbtyperErrorShape
						? [Tokens, E, ParserRefErrorThirdSentinel]
						: [Tokens, null, null]
