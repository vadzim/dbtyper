/**
 * Grammar gate of the typed path (track B, #97; DSEL-5, DSEL-6, DSEL-7). Shape: DECISIONS.md, "Track B: dialect selection
 * shape (#52)" and "Dialect gate (#97)".
 *
 * A statement text is recognised by the driver's own dialect grammar (src/gram). Rejected by it and accepted by the
 * other dialect's grammar: an other-dialect error (1900: PostgreSQL-only syntax with a SQLite driver, 1901: SQLite-only
 * syntax with a PostgreSQL driver) naming the construct. Rejected by both: the ordinary syntax error.
 *
 * - SQLite chains always run the gate (the shared typer is PostgreSQL-shaped and over-accepts).
 * - PostgreSQL chains run it when `PgAlwaysGate` is true, otherwise only when the typer already reported an error.
 */
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { Recognize } from "../gram/driver.ts"
import type { Tables as PgTables } from "../gram/postgres/tables.d.ts"
import type { Tables as SqliteTables } from "../gram/sqlite/tables.d.ts"
import type { PgTerminals } from "../gram/postgres/tokens.ts"
import type { SqliteSyntax, SqliteTerminals } from "../gram/sqlite/tokens.ts"
import type { CreateParserMonad, ParserMonad, PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { Dec, Inc } from "./type-utils.ts"

/** See DECISIONS.md "Dialect gate (#97)": the measured choice. */
export type PgAlwaysGate = false

/** Lexer syntax the PostgreSQL grammar reads the statement with. */
type PgSyntax<Syntax extends string> = Syntax | "quoted-ident-kind"
type PgOtherSyntax = "dollar-strings" | "named-params" | "indexed-params" | "quoted-ident-kind"

/**
 * The error to report for `Stmt`: the gate's, or `TyperError` (the shared typer's error, or null) when the gate has
 * nothing to add. `Syntax` is the driver's lexer syntax (with the chain's params).
 */
export type GateError<
	Dialect extends string,
	Syntax extends string,
	Stmt extends string,
	TyperError extends DbtyperErrorShape | null,
> = string extends Stmt
	? TyperError
	: [Dialect] extends ["sqlite"]
		? SqliteGate<Stmt, TyperError>
		: PgAlwaysGate extends true
			? PgGate<Syntax, Stmt, TyperError>
			: TyperError extends DbtyperErrorShape
				? PgGate<Syntax, Stmt, TyperError>
				: null

type SqliteGate<Stmt extends string, TyperError extends DbtyperErrorShape | null> =
	SqliteTerminals<Stmt> extends infer Own extends string[]
		? Recognize<SqliteTables, Own> extends infer R
			? R extends { ok: true }
				? TyperError
				: R extends { ok: false; at: infer At extends number; token: infer Token extends string }
					? Stmt extends SqliteLexGap
						? TyperError
						: PgTerminals<Stmt, PgOtherSyntax> extends infer Other extends string[]
							? Recognize<PgTables, Other> extends { ok: true }
								? Report<
										"POSTGRES_ONLY_SYNTAX_WITH_SQLITE_DRIVER",
										PgOnly<Stmt, Own, Other, At>,
										TyperError
									>
								: BothReject<TyperError, Token>
							: TyperError
					: TyperError
			: TyperError
		: TyperError

type PgGate<Syntax extends string, Stmt extends string, TyperError extends DbtyperErrorShape | null> =
	PgTerminals<Stmt, PgSyntax<Syntax>> extends infer Own extends string[]
		? Recognize<PgTables, Own> extends infer R
			? R extends { ok: true }
				? TyperError
				: R extends { ok: false; at: infer At extends number }
					? Stmt extends SqliteLexGap
						? TyperError
						: SqliteTerminals<Stmt> extends infer Other extends string[]
							? Recognize<SqliteTables, Other> extends { ok: true }
								? Report<
										"SQLITE_ONLY_SYNTAX_WITH_POSTGRES_DRIVER",
										SqliteOnly<Stmt, PgSyntax<Syntax>, Own, At>,
										TyperError
									>
								: TyperError
							: TyperError
					: TyperError
			: TyperError
		: TyperError

/**
 * SQLite lexemes the shared lexer does not read (src/gram/sqlite/tokens.ts, "Left out"): blob literals x'..', hex
 * numbers, digit separators, a doubled quote inside backtick or bracket identifiers, $name(..). The SQLite token stream
 * of such a text is wrong, so a verdict that rests on it could be a false error: the gate stays silent (the typer's
 * error stays).
 */
type SqliteLexGap =
	| `${string}${"x'" | "X'" | "0x" | "0X" | "``" | "]]" | `${Digit}_${Digit}`}${string}`
	| `${string}$${Letter | Uppercase<Letter>}${string}(${string}`
type Letter =
	| "a"
	| "b"
	| "c"
	| "d"
	| "e"
	| "f"
	| "g"
	| "h"
	| "i"
	| "j"
	| "k"
	| "l"
	| "m"
	| "n"
	| "o"
	| "p"
	| "q"
	| "r"
	| "s"
	| "t"
	| "u"
	| "v"
	| "w"
	| "x"
	| "y"
	| "z"
	| "_"
type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

/**
 * A recognised construct always gives the other-dialect error. An unrecognised one (`near`) only when the typer has no
 * error of its own: the other grammar is looser in places (SQLite accepts any word as a table option), and a typer
 * message such as "Expected INTO after INSERT" is then the better one.
 */
type Report<
	Id extends "POSTGRES_ONLY_SYNTAX_WITH_SQLITE_DRIVER" | "SQLITE_ONLY_SYNTAX_WITH_POSTGRES_DRIVER",
	Construct,
	TyperError,
> = Construct extends [infer Name extends string, infer Hint extends string, infer Kind]
	? Kind extends "near"
		? TyperError extends DbtyperErrorShape
			? TyperError
			: Make<Id, Name, Hint>
		: never
	: Construct extends [infer Name extends string, infer Hint extends string]
		? Make<Id, Name, Hint>
		: TyperError

type Make<
	Id extends string,
	Name extends string,
	Hint extends string,
> = Id extends "POSTGRES_ONLY_SYNTAX_WITH_SQLITE_DRIVER"
	? FormatError<Errors["POSTGRES_ONLY_SYNTAX_WITH_SQLITE_DRIVER"], [Name, Hint]>
	: FormatError<Errors["SQLITE_ONLY_SYNTAX_WITH_POSTGRES_DRIVER"], [Name, Hint]>

/** Rejected by both grammars: the typer's error stays; with none, a plain syntax error (the typer over-accepted). */
type BothReject<
	TyperError extends DbtyperErrorShape | null,
	Token extends string,
> = TyperError extends DbtyperErrorShape ? TyperError : FormatError<Errors["UNEXPECTED_TOKEN"], [Token]>

/** The raw lexer token number `N` (0-based) of the text, read with the same `Syntax` as its terminals. */
type NthToken<M extends ParserMonad, N extends number, Count extends unknown[] = []> = Count["length"] extends N
	? [M, PeekToken<M>]
	: SkipToken<M> extends infer Next extends ParserMonad
		? NthToken<Next, N, [...Count, 0]>
		: never

type TokenAt<Stmt extends string, Syntax extends string, At extends number> =
	NthToken<CreateParserMonad<Stmt, Syntax>, At> extends [infer _M extends ParserMonad, infer Tok] ? Tok : never

type TokenText<Tok> = Tok extends { value: infer V extends string } ? V : "end of statement"

/** The construct is not recognised: the third element is "near" (see `Report`). */
type Near<Tok> = [`syntax near \`${TokenText<Tok>}\``, "", "near"]

type PrevTerminal<Terminals extends string[], At extends number> = At extends 0
	? ""
	: Terminals[Dec<At>] extends infer P extends string
		? P
		: ""

/** [construct, " hint"]; the position of the failing token of the SQLite grammar picks the construct. */
type PgOnly<Stmt extends string, Own extends string[], Other extends string[], At extends number> =
	TokenAt<Stmt, SqliteSyntax, At> extends infer Tok
		? Tok extends { kind: "key"; value: "::" }
			? ["`::` cast", " Use CAST(x AS TEXT)"]
			: Own[At] extends "$error"
				? "param" extends Other[number]
					? ["`$n` parameter", " Use ?NNN, :name, @name or $name"]
					: Near<Tok>
				: "ilike" extends Other[number]
					? ["ILIKE", " Use LIKE (case-insensitive for ASCII in SQLite) or lower(x) LIKE lower(y)"]
					: Near<Tok>
		: never

/** Same for a PostgreSQL grammar failure at token `At` of `Own` (read with PostgreSQL's `Syntax`). */
type SqliteOnly<Stmt extends string, Syntax extends string, Own extends string[], At extends number> =
	TokenAt<Stmt, Syntax, At> extends infer Tok
		? Own[At] extends "or"
			? PrevTerminal<Own, At> extends "insert" | "update"
				? OrConflict<PrevTerminal<Own, At>, TokenAt<Stmt, Syntax, Inc<At>>>
				: Near<Tok>
			: Tok extends { kind: "key"; value: "?" }
				? TokenAt<Stmt, Syntax, Inc<At>> extends { kind: "int" }
					? ["`?NNN` parameter", " Use $1, $2, …"]
					: Near<Tok>
				: Tok extends { kind: "ident"; value: "replace" | "pragma" }
					? At extends 0
						? Tok["value"] extends "pragma"
							? ["PRAGMA", ""]
							: ["REPLACE INTO", " Use INSERT … ON CONFLICT … DO UPDATE"]
						: Near<Tok>
					: Stmt extends `${string}\`${string}`
						? ["Backtick-quoted identifier", ' Use "double quotes"']
						: Near<Tok>
		: never

type OrConflict<Verb extends string, Word> = Word extends { value: infer W extends string }
	? [
			`${Uppercase<Verb>} OR ${Uppercase<W>}`,
			W extends "ignore"
				? " Use ON CONFLICT DO NOTHING"
				: W extends "replace"
					? " Use ON CONFLICT … DO UPDATE"
					: "",
		]
	: [`${Uppercase<Verb>} OR`, ""]
