import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenNumber } from "../lexer/sql-lexer.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors } from "../dbtyper-error.ts"
import type { SkipFailedExpression, SkipBracketedUntil } from "./skip-statement.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"

/** Collect type name words (e.g., "double", "precision" → ["double", "precision"]) */
export type CollectSqlTypeWords<Tokens extends ParserMonad, Acc extends readonly string[] = []> =
	PeekToken<Tokens> extends TokenIdent<infer W extends string>
		? CollectSqlTypeWords<SkipToken<Tokens>, [...Acc, W]>
		: [Tokens, Acc]

/** Convert type words to lowercase space-separated string */
export type TypeWordsToString<A extends readonly string[]> = A extends readonly [
	infer H extends string,
	...infer T extends readonly string[],
]
	? T extends readonly []
		? Lowercase<H>
		: `${Lowercase<H>} ${TypeWordsToString<T>}`
	: ""

/** Normalize SQL type aliases to canonical names */
export type NormalizeSqlTypeName<T extends string> = T extends "int" | "int4"
	? "integer"
	: T extends "int2"
		? "smallint"
		: T extends "int8"
			? "bigint"
			: T extends "float8" | "double precision"
				? "double precision"
				: T extends "float4"
					? "real"
					: T extends "bool"
						? "boolean"
						: T extends "character varying"
							? "varchar"
							: T

/** Parse numeric literal from token string */
type ParseNumericLiteral<S extends string> = S extends `${infer N extends number}` ? N : never

/** Parse array suffix `[]` after a type, returning SqlTypeShape with array wrapper */
export type ParseArraySuffix<Tokens extends ParserMonad, BaseType extends SqlTypeShape> =
	PeekToken<Tokens> extends TokenKey<"[">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"]">
				? ParseArraySuffix<SkipToken<R1>, { type: "array"; arg: BaseType; nullable: false }>
				: SkipFailedExpression<
						R1,
						FormatError<Errors["EXPECTED_CLOSE_BRACKET_AFTER_OPEN_BRACKET_IN_ARRAY_TYPE"], []>
					>
			: never
		: [Tokens, BaseType]

/** Parse NULL/NOT NULL keywords and set nullability */
export type ParseNullability<Tokens extends ParserMonad, BaseType extends SqlTypeShape> =
	PeekToken<Tokens> extends TokenKey<"not">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"null">
				? [SkipToken<R1>, { type: BaseType["type"]; arg: BaseType["arg"]; nullable: false }]
				: [R1, { type: BaseType["type"]; arg: BaseType["arg"]; nullable: true }]
			: never
		: PeekToken<Tokens> extends TokenKey<"null">
			? [SkipToken<Tokens>, { type: BaseType["type"]; arg: BaseType["arg"]; nullable: true }]
			: [Tokens, { type: BaseType["type"]; arg: BaseType["arg"]; nullable: true }]

/** Parse VARCHAR(n) or CHAR(n) length parameter */
type ParseVarcharLength<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenNumber<infer N extends string>
		? ParseNumericLiteral<N> extends infer Num extends number
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<")">
					? [SkipToken<R1>, Num]
					: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_VARCHAR_LENGTH"], []>>
				: never
			: SkipFailedExpression<Tokens, FormatError<Errors["INVALID_NUMBER_FOR_VARCHAR_LENGTH"], []>>
		: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_NUMBER_FOR_VARCHAR_LENGTH"], []>>

/** Parse NUMERIC(precision) or NUMERIC(precision, scale) */
type ParseNumericPrecisionScale<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenNumber<infer P extends string>
		? ParseNumericLiteral<P> extends infer Precision extends number
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<",">
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? PeekToken<R2> extends TokenNumber<infer S extends string>
							? ParseNumericLiteral<S> extends infer Scale extends number
								? SkipToken<R2> extends infer R3 extends ParserMonad
									? PeekToken<R3> extends TokenKey<")">
										? [SkipToken<R3>, { precision: Precision; scale: Scale }]
										: SkipFailedExpression<
												R3,
												FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_NUMERIC_SCALE"], []>
											>
									: never
								: SkipFailedExpression<R2, FormatError<Errors["INVALID_SCALE_NUMBER"], []>>
							: SkipFailedExpression<R2, FormatError<Errors["EXPECTED_SCALE_NUMBER"], []>>
						: never
					: PeekToken<R1> extends TokenKey<")">
						? [SkipToken<R1>, { precision: Precision; scale: 0 }]
						: SkipFailedExpression<
								R1,
								FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_NUMERIC_PRECISION"], []>
							>
				: never
			: SkipFailedExpression<Tokens, FormatError<Errors["INVALID_PRECISION_NUMBER"], []>>
		: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_PRECISION_NUMBER"], []>>

/** Parse type modifiers like (n) for VARCHAR, (p,s) for NUMERIC */
type ParseTypeModifiers<Tokens extends ParserMonad, BaseTypeName extends string> =
	PeekToken<Tokens> extends TokenKey<"(">
		? SkipToken<Tokens> extends infer R0 extends ParserMonad
			? BaseTypeName extends "varchar" | "character varying" | "char"
				? ParseVarcharLength<R0> extends [infer R1 extends ParserMonad, infer Len extends number]
					? [R1, { type: BaseTypeName; arg: Len; nullable: false }]
					: never
				: BaseTypeName extends "numeric" | "decimal"
					? ParseNumericPrecisionScale<R0> extends [
							infer R1 extends ParserMonad,
							infer Arg extends { precision: number; scale: number },
						]
						? [R1, { type: BaseTypeName; arg: Arg; nullable: false }]
						: never
					: // Other parameterized types - skip the parens for now
						SkipBracketedUntil<R0, TokenKey<")">> extends [infer R1 extends ParserMonad, infer _]
						? [R1, { type: BaseTypeName; arg: null; nullable: false }]
						: never
			: never
		: [Tokens, { type: BaseTypeName; arg: null; nullable: false }]

/** Main entry point: parse SQL type and return SqlTypeShape */
export type ParseSqlType<Tokens extends ParserMonad> =
	CollectSqlTypeWords<Tokens> extends [infer AfterWords extends ParserMonad, infer Words extends readonly string[]]
		? Words extends readonly []
			? SkipFailedExpression<AfterWords, FormatError<Errors["EXPECTED_TYPE_NAME"], [""]>>
			: TypeWordsToString<Words> extends infer TypeName extends string
				? NormalizeSqlTypeName<TypeName> extends infer NormalizedName extends string
					? ParseTypeModifiers<AfterWords, NormalizedName> extends [
							infer AfterMods extends ParserMonad,
							infer BaseShape extends SqlTypeShape,
						]
						? ParseArraySuffix<AfterMods, BaseShape> extends [
								infer AfterArray extends ParserMonad,
								infer ArrayShape extends SqlTypeShape,
							]
							? ParseNullability<AfterArray, ArrayShape>
							: never
						: never
					: never
				: never
		: never
