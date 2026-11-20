import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { ParserMonad, PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenIdent, TokenKey } from "../lexer/sql-lexer.ts"
import type { SkipBracketedUntil, SkipFailedExpression, SkipFailedExpressionWithEnv } from "./skip-statement.ts"
import type { ExprParseEnv, ScalarExprAst } from "./parse-expression-ast.ts"
import type { ParseOrScalarUntyped } from "./parse-expression-bool.ts"

/** `AS` / `::` type list: identifiers, optional `(…)` after a name, until `)` (CAST) or non-type token (`::` chain). */
type ParseSqlTypeName<Tokens extends ParserMonad, Acc extends readonly string[] = []> =
	PeekToken<Tokens> extends TokenIdent<infer W extends string>
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"(">
				? SkipBracketedUntil<SkipToken<R1>, TokenKey<")">> extends [infer R2 extends ParserMonad, infer Rs]
					? Rs extends DbtyperErrorShape
						? SkipFailedExpression<R2, Rs>
						: ParseSqlTypeName<SkipToken<R2>, readonly [...Acc, W]>
					: never
				: PeekToken<R1> extends TokenKey<".">
					? ParseSqlTypeName<SkipToken<R1>, readonly [...Acc, `${W}.`]>
					: PeekToken<R1> extends TokenIdent<string>
						? ParseSqlTypeName<R1, readonly [...Acc, W]>
						: [R1, readonly [...Acc, W]]
			: never
		: PeekToken<Tokens> extends TokenKey<")">
			? Acc extends readonly []
				? SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_TYPE_NAME"], [""]>>
				: [Tokens, Acc]
			: Acc extends readonly []
				? SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_TYPE_NAME"], [""]>>
				: [Tokens, Acc]

/** True when `C` has exactly one own key (one projected column). */
export type SingleProjectionColumn<C extends Record<string, unknown>> = keyof C extends infer A
	? A extends keyof C
		? { [B in keyof C]: B extends A ? 1 : 0 }[keyof C] extends 1
			? true
			: false
		: false
	: false

export type ParseCastKeywordOperand<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"cast">
		? SkipToken<Tokens> extends infer R0 extends ParserMonad
			? PeekToken<R0> extends TokenKey<"(">
				? SkipToken<R0> extends infer R1 extends ParserMonad
					? ParseOrScalarUntyped<R1, Env> extends [
							infer R2 extends ParserMonad,
							infer Inner,
							infer Env2 extends ExprParseEnv,
						]
						? Inner extends DbtyperErrorShape
							? SkipFailedExpressionWithEnv<R2, Inner, Env2>
							: Inner extends ScalarExprAst
								? PeekToken<R2> extends TokenKey<"as">
									? SkipToken<R2> extends infer R3 extends ParserMonad
										? ParseSqlTypeName<R3, []> extends [infer R4 extends ParserMonad, infer Parts]
											? Parts extends DbtyperErrorShape
												? SkipFailedExpressionWithEnv<R4, Parts, Env2>
												: Parts extends readonly []
													? SkipFailedExpressionWithEnv<
															R4,
															FormatError<
																Errors["EXPECTED_TYPE_NAME"],
																["after CAST ... AS"]
															>,
															Env2
														>
													: Parts extends readonly string[]
														? PeekToken<R4> extends infer TokCl
															? SkipToken<R4> extends infer R5 extends ParserMonad
																? TokCl extends TokenKey<")">
																	? [
																			R5,
																			{
																				kind: "sql_cast"
																				expr: Inner
																				type_parts: Parts
																			},
																			Env2,
																		]
																	: [
																			R5,
																			FormatError<
																				Errors["EXPECTED_CLOSE_PAREN_AFTER_CAST_TYPE"],
																				[]
																			>,
																			Env2,
																		]
																: never
															: never
														: never
											: never
										: never
									: SkipFailedExpressionWithEnv<
											R2,
											FormatError<Errors["EXPECTED_AS_IN_CAST"], []>,
											Env2
										>
								: never
						: never
					: never
				: SkipFailedExpressionWithEnv<R0, FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_CAST"], []>, Env>
			: never
		: never

export type ParsePgCastSuffixTail<Tokens extends ParserMonad, Acc extends ScalarExprAst> =
	PeekToken<Tokens> extends TokenKey<"::">
		? SkipToken<Tokens> extends infer R0 extends ParserMonad
			? ParseSqlTypeName<R0, []> extends [infer R1 extends ParserMonad, infer Parts]
				? Parts extends DbtyperErrorShape
					? SkipFailedExpression<R1, Parts>
					: Parts extends readonly []
						? SkipFailedExpression<R1, FormatError<Errors["EXPECTED_TYPE_NAME"], ["after ::"]>>
						: Parts extends readonly string[]
							? ParsePgCastSuffixTail<R1, { kind: "pg_cast"; expr: Acc; type_parts: Parts }>
							: never
				: never
			: never
		: [Tokens, Acc]
