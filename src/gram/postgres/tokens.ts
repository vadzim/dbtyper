/**
 * PostgreSQL: type-level lexer tokens (src/lexer/sql-lexer.ts) -> terminal names of gram.y (#93, DECISIONS.md #52).
 * Replaces the former `with_la` hack in parser-monad.ts: the one-token lookaheads of PostgreSQL's parser.c
 * (`base_yylex`) live here.
 *
 * Limits: the lexer yields a quoted and an unquoted non-service word alike as an ident, so an ident whose text is a
 * PostgreSQL keyword is taken as that keyword (`"analyze"` in quotes is read as the keyword). Words of the lexer's
 * keyword list that PostgreSQL has no keyword for (`use`, `virtual`, ...) are plain identifiers here.
 */
import type { CreateParserMonad, ParserMonad, PeekToken, SkipToken } from "../../lexer/parser-monad.ts"
import type { LexerFeatures } from "../../lexer/sql-lexer.ts"
import type { Keywords } from "./keywords.ts"

/** Terminals of the query text, without `$end`. A lexer error becomes the terminal `$error`, which no state accepts. */
export type PgTerminals<Query extends string, Syntax extends string = LexerFeatures> = Collect<
	CreateParserMonad<Query, Syntax>
>

type Collect<M extends ParserMonad, Acc extends string[] = []> =
	PeekToken<M> extends infer Tok
		? Tok extends { kind: "eot" }
			? Acc
			: Tok extends { kind: infer K extends string; value: infer V extends string }
				? PeekToken<SkipToken<M>> extends infer Next
					? Collect<SkipToken<M>, [...Acc, Terminal<K, V, Next>]>
					: never
				: Collect<SkipToken<M>, [...Acc, "$error"]>
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
