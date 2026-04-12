import type { TrimLeft } from "./sql-parse-primitives.js"
import type { ParseSqlTokens, SqlParserError, TokensList } from "./sql-tokens.js"
import type { SqlIgnorableStatement } from "./sql-ignorable.js"

type Inc<D extends readonly 0[]> = readonly [0, ...D]
type DecP<D extends readonly 0[]> = D extends readonly [0, ...infer R extends readonly 0[]] ? R : never
type DecBk<D extends readonly 0[]> = D extends readonly [0, ...infer R extends readonly 0[]] ? R : never

/**
 * Lexical skip from the start of a statement buffer to the first top-level `;`.
 * Tracks `()`, `[]`, line/block comments, single/double-quoted strings, and PostgreSQL dollar quotes (`$$` / `$tag$`).
 */
// TODO:
export type SkipStatementFromBuffer<B extends TokensList> = B["__buffer__"] extends infer Raw extends string
	? TrimLeft<Raw> extends ""
		? [SqlParserError<"Unclosed statement">, B]
		: ScanSkip<TrimLeft<Raw>> extends infer R
			? R extends SqlParserError<string>
				? [R, B]
				: R extends [true, infer After extends string]
					? [SqlIgnorableStatement, ParseSqlTokens<TrimLeft<After>>]
					: [SqlParserError<"Unclosed statement">, B]
			: [SqlParserError<"Unclosed statement">, B]
	: [SqlParserError<"Unclosed statement">, B]

type ScanSkip<S extends string, P extends readonly 0[] = [], Bk extends readonly 0[] = []> = S extends ""
	? SqlParserError<"Unclosed statement">
	: S extends `;${infer Rest}`
		? P["length"] extends 0
			? Bk["length"] extends 0
				? [true, Rest]
				: ScanSkip<Rest, P, Bk>
			: ScanSkip<Rest, P, Bk>
		: S extends `(${infer Rest}`
			? ScanSkip<Rest, Inc<P>, Bk>
			: S extends `)${infer Rest}`
				? P extends readonly [0, ...infer PTail extends readonly 0[]]
					? ScanSkip<Rest, PTail, Bk>
					: SqlParserError<"Unbalanced parentheses in skipped statement">
				: S extends `[${infer Rest}`
					? ScanSkip<Rest, P, Inc<Bk>>
					: S extends `]${infer Rest}`
						? Bk extends readonly [0, ...infer BTail extends readonly 0[]]
							? ScanSkip<Rest, P, BTail>
							: SqlParserError<"Unbalanced brackets in skipped statement">
						: S extends `--${infer Line}`
							? Line extends `${string}\n${infer Rest}`
								? ScanSkip<Rest, P, Bk>
								: SqlParserError<"Unclosed statement">
							: S extends `/*${infer Com}`
								? Com extends `${string}*/${infer Rest}`
									? ScanSkip<Rest, P, Bk>
									: SqlParserError<"Unclosed statement">
								: S extends `"${infer Rest}`
									? ScanDoubleQuoted<Rest, P, Bk>
									: S extends `'${infer Rest}`
										? ScanSingleQuoted<Rest, P, Bk>
										: S extends `$$${infer Rest}`
											? ScanEmptyDollarBody<Rest> extends infer D
												? D extends SqlParserError<string>
													? D
													: D extends [infer After extends string]
														? ScanSkip<After, P, Bk>
														: SqlParserError<"Unclosed statement">
												: SqlParserError<"Unclosed statement">
											: S extends `$${infer Tag}$${infer Rest}`
												? Tag extends `${string}$${string}`
													? ScanSkip<S, P, Bk>
													: CloseTaggedDollar<Rest, Tag> extends infer D
														? D extends SqlParserError<string>
															? D
															: D extends [infer After extends string]
																? ScanSkip<After, P, Bk>
																: SqlParserError<"Unclosed statement">
														: SqlParserError<"Unclosed statement">
												: S extends `${infer _C}${infer Tail}`
													? Tail extends string
														? ScanSkip<Tail, P, Bk>
														: SqlParserError<"Unclosed statement">
													: SqlParserError<"Unclosed statement">

type ScanDoubleQuoted<S extends string, P extends readonly 0[], Bk extends readonly 0[]> = S extends `"${infer After}`
	? ScanSkip<After, P, Bk>
	: S extends `""${infer Rest}`
		? ScanDoubleQuoted<Rest, P, Bk>
		: S extends `${infer _C}${infer Rest}`
			? ScanDoubleQuoted<Rest, P, Bk>
			: SqlParserError<"Unclosed string in skipped statement">

type ScanSingleQuoted<S extends string, P extends readonly 0[], Bk extends readonly 0[]> = S extends `'${infer After}`
	? ScanSkip<After, P, Bk>
	: S extends `''${infer Rest}`
		? ScanSingleQuoted<Rest, P, Bk>
		: S extends `${infer _C}${infer Rest}`
			? ScanSingleQuoted<Rest, P, Bk>
			: SqlParserError<"Unclosed string in skipped statement">

type ScanEmptyDollarBody<S extends string> = S extends `$$${infer After}`
	? [After]
	: S extends `${infer _C}${infer T}`
		? ScanEmptyDollarBody<T>
		: SqlParserError<"Unclosed statement">

type CloseTaggedDollar<S extends string, Tag extends string> = S extends `$${Tag}$${infer After}`
	? [After]
	: S extends `${infer _C}${infer T}`
		? CloseTaggedDollar<T, Tag>
		: SqlParserError<"Unclosed dollar quote in skipped statement">

/** Advance from `B` to the buffer after the next top-level `;` (same rules as {@link SkipStatementFromBuffer} but no ignorable wrapper). */
export type SkipTailToSemicolonBuffer<B extends TokensList> =
	TrimLeft<B["__buffer__"]> extends infer S extends string
		? ScanSkip<S> extends infer R
			? R extends SqlParserError<string>
				? [R, B]
				: R extends [true, infer After extends string]
					? [true, ParseSqlTokens<TrimLeft<After>>]
					: [SqlParserError<"Unclosed statement">, B]
			: [SqlParserError<"Unclosed statement">, B]
		: [SqlParserError<"Unclosed statement">, B]
