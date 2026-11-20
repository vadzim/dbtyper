import type { DialectFact } from "../core/dialect.ts"
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

/** After the alias name: the tokens that must follow it. */
type AliasTail<AfterAlias extends ParserMonad, Row extends AliasRow, Alias extends string> =
	PeekToken<AfterAlias> extends Row["tail"]
		? [AfterAlias, null, Alias]
		: Row["tailError"] extends infer E extends DbtyperErrorShape
			? [AfterAlias, E, ParserRefErrorThirdSentinel]
			: [AfterAlias, null, Alias]

/** After `AS`. */
type AliasAfterAs<AfterAs extends ParserMonad, Row extends AliasRow> =
	AsIdent<PeekToken<AfterAs>> extends TokenIdent<infer Alias extends string>
		? AliasTail<SkipToken<AfterAs>, Row, Alias>
		: [AfterAs, Row["afterAs"], ParserRefErrorThirdSentinel]

/** The bare token is a name; may a bare alias be written here? */
type AliasBareName<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Row extends AliasRow,
	Alias extends string,
> = Row["bare"] extends "allowed"
	? AliasTail<SkipToken<Tokens>, Row, Alias>
	: Row["bare"] extends "dml"
		? DialectFact<Db, "bareDmlAlias"> extends true
			? AliasTail<SkipToken<Tokens>, Row, Alias>
			: [
					Tokens,
					FormatError<Errors["BARE_DML_ALIAS_NEEDS_AS"], [Row["verb"], Alias]>,
					ParserRefErrorThirdSentinel,
				]
		: [Tokens, Row["afterAs"], ParserRefErrorThirdSentinel]

/**
 * The one reader of `[AS] alias`: `[rest, null, alias]`, `[rest, null, null]` (no alias: the table keeps its name),
 * or `[rest, error, ParserRefErrorThirdSentinel]`.
 */
export type ParseAlias<Tokens extends ParserMonad, Db extends JsqlDatabaseShape, Row extends AliasRow> =
	PeekToken<Tokens> extends TokenKey<"as">
		? AliasAfterAs<SkipToken<Tokens>, Row>
		: PeekToken<Tokens> extends Row["ends"]
			? [Tokens, null, null]
			: AsIdent<PeekToken<Tokens>> extends TokenIdent<infer Alias extends string>
				? AliasBareName<Tokens, Db, Row, Alias>
				: Row["bad"] extends infer E extends DbtyperErrorShape
					? [Tokens, E, ParserRefErrorThirdSentinel]
					: [Tokens, null, null]
