/**
 * PostgreSQL: type-level lexer tokens (src/lexer/sql-lexer.ts) -> terminal names of gram.y (#93, DECISIONS.md #52).
 * Replaces the former `with_la` hack in parser-monad.ts: the one-token lookaheads of PostgreSQL's parser.c
 * (`base_yylex`) live here.
 *
 * A quoted identifier is a `quoted_ident` token (lexer feature `quoted-ident-kind`, on in the default syntax here) and
 * always `ident`: `"analyze"` is not the keyword (#96; before, #93, it was). A bare word whose text is a PostgreSQL
 * keyword is that keyword. Words of the lexer's keyword list that PostgreSQL has no keyword for (`use`, `virtual`, ...)
 * are plain identifiers here.
 */
import type { CreateParserMonad, ParserMonad, PeekToken, SkipToken } from "../../lexer/parser-monad.ts"
import type { LexerFeatures } from "../../lexer/sql-lexer.ts"
import type { Keywords } from "./keywords.ts"

/** Terminals of the query text, without `$end`. A lexer error becomes the terminal `$error`, which no state accepts. */
export type PgTerminals<Query extends string, Syntax extends string = LexerFeatures | "quoted-ident-kind"> =
	Collect<CreateParserMonad<Query, Syntax>> extends [infer _M extends ParserMonad, infer Terminals extends string[]]
		? Terminals
		: never

type Collect<M extends ParserMonad, Acc extends string[] = []> =
	PeekToken<M> extends infer Tok
		? Tok extends { kind: "eot" }
			? [M, Acc]
			: SkipToken<M> extends infer Rest extends ParserMonad
				? Tok extends { kind: infer K extends string; value: infer V extends string }
					? Collect<Rest, [...Acc, Terminal<K, V, PeekToken<Rest>>]>
					: [Rest, [...Acc, "$error"]] /* a lexer error does not advance: stop */
				: never
		: never

type NextWord<Next> = Next extends { kind: "key" | "ident"; value: infer V extends string } ? V : never

type Terminal<Kind extends string, Value extends string, Next> = Kind extends "int"
	? "iconst"
	: Kind extends "float"
		? "fconst"
		: Kind extends "string"
			? "sconst"
			: Kind extends "param" | "indexed_param"
				? "param"
				: Kind extends "quoted_ident"
					? "ident"
					: Kind extends "ident"
						? WordTerminal<Value, Next>
						: Kind extends "key"
							? Value extends `${Letter}${string}`
								? WordTerminal<Value, Next>
								: SymbolTerminal<Value>
							: "$error"

type Letter =
	| Lowercase<"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m">
	| Lowercase<"n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z" | "_">

type WordTerminal<Word extends string, Next> = Word extends keyof Keywords ? Lookahead<Keywords[Word], Next> : "ident"

/** parser.c: NOT_LA, NULLS_LA, WITH_LA, WITHOUT_LA, FORMAT_LA */
type Lookahead<Term extends string, Next> = Term extends "not"
	? NextWord<Next> extends "between" | "in" | "like" | "ilike" | "similar"
		? "not_la"
		: Term
	: Term extends "nulls_p"
		? NextWord<Next> extends "first" | "last"
			? "nulls_la"
			: Term
		: Term extends "with"
			? NextWord<Next> extends "time" | "ordinality"
				? "with_la"
				: Term
			: Term extends "without"
				? NextWord<Next> extends "time"
					? "without_la"
					: Term
				: Term extends "format"
					? NextWord<Next> extends "json"
						? "format_la"
						: Term
					: Term

/** scan.l: self characters and the multi-character operators with their own token; everything else is `Op`. */
type SymbolTerminal<Sym extends string> = Sym extends
	| ","
	| "("
	| ")"
	| "["
	| "]"
	| "."
	| ";"
	| ":"
	| "+"
	| "-"
	| "*"
	| "/"
	| "%"
	| "^"
	| "<"
	| ">"
	| "="
	? Sym
	: Sym extends "?"
		? "$error" // a bare `?` (SQLite parameter) is no PostgreSQL token here; jsonb `?` is not typed by dbtyper (#97)
		: Sym extends "::"
			? "typecast"
			: Sym extends ".."
				? "dot_dot"
				: Sym extends ":="
					? "colon_equals"
					: Sym extends "=>"
						? "equals_greater"
						: Sym extends "<="
							? "less_equals"
							: Sym extends ">="
								? "greater_equals"
								: Sym extends "<>" | "!="
									? "not_equals"
									: "Op"
