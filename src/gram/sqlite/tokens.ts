/**
 * SQLite: type-level lexer tokens (src/lexer/sql-lexer.ts) -> terminal names of gram.y (#96, DECISIONS.md #52).
 * Terminal names are the lemon names of parse.y in lower case (`id`, `lp`, `join_kw`, ...).
 *
 * Lexer features used (see `LexerGramFeatures`): `sqlite-lexemes` (backtick and `[bracket]` identifiers, `?NNN`, `@name`,
 * `$name`), `quoted-ident-kind` (a quoted word is `quoted_ident`, always `id`: `"abort"` is not the keyword), plus
 * `named-params` (`:name`).
 *
 * What the tokenizer of SQLite does that is done here: keyword text -> token (`Keywords`, from mkkeywordhash.c; words
 * without a token and `true`/`false` are `id`), `?`/`:name`/`@name`/`$name` -> `variable`, WINDOW / OVER / FILTER only
 * as keywords in their context (tokenize.c analyze*Keyword), a final `;` is appended (sqlite3RunParser does that).
 * `%fallback` (keyword -> `id`) is the driver's `Fallback` table.
 *
 * Left out: blob literals `x'..'` (read as `id` then `string`), a doubled quote inside `` `x` `` / `[x]`, the SQLite
 * number forms the shared lexer does not read (hex `0x..`, digit separators `1_000` -> QNUMBER), the `$name(suffix)` /
 * `$a::b` tcl forms, `ISNOT`-style synthesized tokens, comments are the shared lexer's. Unknown symbols give the terminal
 * `illegal`, which no state accepts.
 */
import type { CreateParserMonad, ParserMonad, PeekToken, SkipToken } from "../../lexer/parser-monad.ts"
import type { LexerFeatures, LexerGramFeatures } from "../../lexer/sql-lexer.ts"
import type { Keywords } from "./keywords.ts"

export type SqliteSyntax = "named-params" | LexerGramFeatures | Extract<LexerFeatures, "dialect-sqlite">

/** Terminals of the query text, without `$end`. A lexer error becomes the terminal `$error`, which no state accepts. */
export type SqliteTerminals<Query extends string, Syntax extends string = SqliteSyntax> =
	Collect<CreateParserMonad<Query, Syntax>> extends [infer _M extends ParserMonad, infer Terminals extends string[]]
		? Terminals extends [...string[], "semi"] | []
			? Terminals
			: [...Terminals, "semi"]
		: never

/**
 * `Prev` = the previous terminal; `Pend` = "w1" after a tentative `window` (a window name must follow), "w2" after
 * `window <id>` (`as` must follow): when the context fails, the tentative `window` is patched to `id` (rare path).
 */
type Collect<M extends ParserMonad, Acc extends string[] = [], Prev extends string = "", Pend extends string = ""> =
	PeekToken<M> extends infer Tok
		? Tok extends { kind: "eot" }
			? [M, Patch<Acc, Pend>]
			: SkipToken<M> extends infer Rest extends ParserMonad
				? Tok extends { kind: infer K extends string; value: infer V extends string }
					? Terminal<K, V, Prev, PeekToken<Rest>> extends infer T extends string
						? Pend extends "w1"
							? IsPlainId<Tok> extends true
								? Collect<Rest, [...Acc, T], T, "w2">
								: Collect<Rest, [...Patch<Acc, Pend>, T], T, T extends "window" ? "w1" : "">
							: Pend extends "w2"
								? T extends "as"
									? Collect<Rest, [...Acc, T], T>
									: Collect<Rest, [...Patch<Acc, Pend>, T], T, T extends "window" ? "w1" : "">
								: Collect<Rest, [...Acc, T], T, T extends "window" ? "w1" : "">
						: never
					: [Rest, [...Patch<Acc, Pend>, "$error"]] // a lexer error does not advance the monad: stop
				: never
		: never

type Patch<Acc extends string[], Pend extends string> = Pend extends "w1"
	? Acc extends [...infer Init extends string[], "window"]
		? [...Init, "id"]
		: Acc
	: Pend extends "w2"
		? Acc extends [...infer Init extends string[], "window", infer Name extends string]
			? [...Init, "id", Name]
			: Acc
		: Acc

type Terminal<Kind extends string, Value extends string, Prev extends string, Next> = Kind extends "int"
	? "integer"
	: Kind extends "float"
		? "float"
		: Kind extends "string"
			? "string"
			: Kind extends "param" | "indexed_param"
				? "variable"
				: Kind extends "quoted_ident"
					? "id"
					: Kind extends "ident"
						? WordTerminal<Value, Prev, Next>
						: Kind extends "key"
							? Value extends `${Letter}${string}`
								? WordTerminal<Value, Prev, Next>
								: SymbolTerminal<Value>
							: "$error"

type Letter =
	| Lowercase<"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m">
	| Lowercase<"n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z" | "_">

/** WINDOW is tentative here (see `Collect`); OVER and FILTER are keywords only after `)` (tokenize.c analyze*Keyword) */
type WordTerminal<Word extends string, Prev extends string, Next> = Word extends keyof Keywords
	? Keywords[Word] extends infer Term extends string
		? Term extends "over"
			? Prev extends "rp"
				? Next extends { kind: "key"; value: "(" }
					? Term
					: IsPlainId<Next> extends true
						? Term
						: "id"
				: "id"
			: Term extends "filter"
				? Prev extends "rp"
					? Next extends { kind: "key"; value: "(" }
						? Term
						: "id"
					: "id"
				: Term
		: never
	: "id"

/** tokenize.c: a window name or an alias is a token that is TK_ID (not a keyword) */
type IsPlainId<Tok> = Tok extends { kind: "quoted_ident" }
	? true
	: Tok extends { kind: "ident" | "key"; value: infer V extends string }
		? V extends `${Letter}${string}`
			? V extends keyof Keywords
				? false
				: true
			: false
		: false

type SymbolTerminal<Sym extends string> = Sym extends ","
	? "comma"
	: Sym extends "("
		? "lp"
		: Sym extends ")"
			? "rp"
			: Sym extends ";"
				? "semi"
				: Sym extends "."
					? "dot"
					: Sym extends "+"
						? "plus"
						: Sym extends "-"
							? "minus"
							: Sym extends "*"
								? "star"
								: Sym extends "/"
									? "slash"
									: Sym extends "%"
										? "rem"
										: Sym extends "||"
											? "concat"
											: Sym extends "->" | "->>"
												? "ptr"
												: Sym extends "=" | "=="
													? "eq"
													: Sym extends "<>" | "!="
														? "ne"
														: Sym extends "<"
															? "lt"
															: Sym extends ">"
																? "gt"
																: Sym extends "<="
																	? "le"
																	: Sym extends ">="
																		? "ge"
																		: Sym extends "&"
																			? "bitand"
																			: Sym extends "|"
																				? "bitor"
																				: Sym extends "~"
																					? "bitnot"
																					: Sym extends "<<"
																						? "lshift"
																						: Sym extends ">>"
																							? "rshift"
																							: Sym extends "?"
																								? "variable"
																								: "illegal"
