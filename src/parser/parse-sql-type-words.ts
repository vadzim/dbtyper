import type { PeekToken, SkipToken, TokenIdent, TokenKey, TokensList, TokenNumber } from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { SkipFailedExpression, SkipBracketedUntil } from "./skip-statement.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"

/** Collect type name words (e.g., "double", "precision" → ["double", "precision"]) */
export type CollectSqlTypeWords<Tokens extends TokensList, Acc extends readonly string[] = []> =
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
export type ParseArraySuffix<Tokens extends TokensList, BaseType extends SqlTypeShape> =
	PeekToken<Tokens> extends TokenKey<"[">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? PeekToken<R1> extends TokenKey<"]">
				? SkipToken<R1> extends infer R2 extends TokensList
					? ParseArraySuffix<R2, { type: "array"; arg: BaseType; nullable: false }>
					: never
				: SkipFailedExpression<R1, SqlParserError<"Expected ] after [ in array type">>
			: never
		: [Tokens, BaseType]

/** Parse NULL/NOT NULL keywords and set nullability */
export type ParseNullability<Tokens extends TokensList, BaseType extends SqlTypeShape> =
	PeekToken<Tokens> extends TokenKey<"not">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? PeekToken<R1> extends TokenKey<"null">
				? [SkipToken<R1>, { type: BaseType["type"]; arg: BaseType["arg"]; nullable: false }]
				: [R1, { type: BaseType["type"]; arg: BaseType["arg"]; nullable: true }]
			: never
		: PeekToken<Tokens> extends TokenKey<"null">
			? [SkipToken<Tokens>, { type: BaseType["type"]; arg: BaseType["arg"]; nullable: true }]
			: [Tokens, { type: BaseType["type"]; arg: BaseType["arg"]; nullable: true }]

/** Parse VARCHAR(n) or CHAR(n) length parameter */
type ParseVarcharLength<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenNumber<infer N extends string>
		? ParseNumericLiteral<N> extends infer Num extends number
			? SkipToken<Tokens> extends infer R1 extends TokensList
				? PeekToken<R1> extends TokenKey<")">
					? [SkipToken<R1>, Num]
					: SkipFailedExpression<R1, SqlParserError<"Expected ) after VARCHAR length">>
				: never
			: SkipFailedExpression<Tokens, SqlParserError<"Invalid number for VARCHAR length">>
		: SkipFailedExpression<Tokens, SqlParserError<"Expected number for VARCHAR length">>

/** Parse NUMERIC(precision) or NUMERIC(precision, scale) */
type ParseNumericPrecisionScale<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenNumber<infer P extends string>
		? ParseNumericLiteral<P> extends infer Precision extends number
			? SkipToken<Tokens> extends infer R1 extends TokensList
				? PeekToken<R1> extends TokenKey<",">
					? SkipToken<R1> extends infer R2 extends TokensList
						? PeekToken<R2> extends TokenNumber<infer S extends string>
							? ParseNumericLiteral<S> extends infer Scale extends number
								? SkipToken<R2> extends infer R3 extends TokensList
									? PeekToken<R3> extends TokenKey<")">
										? [SkipToken<R3>, { precision: Precision; scale: Scale }]
										: SkipFailedExpression<R3, SqlParserError<"Expected ) after NUMERIC scale">>
									: never
								: SkipFailedExpression<R2, SqlParserError<"Invalid scale number">>
							: SkipFailedExpression<R2, SqlParserError<"Expected scale number">>
						: never
					: PeekToken<R1> extends TokenKey<")">
						? [SkipToken<R1>, { precision: Precision; scale: 0 }]
						: SkipFailedExpression<R1, SqlParserError<"Expected , or ) after NUMERIC precision">>
				: never
			: SkipFailedExpression<Tokens, SqlParserError<"Invalid precision number">>
		: SkipFailedExpression<Tokens, SqlParserError<"Expected precision number">>

/** Parse type modifiers like (n) for VARCHAR, (p,s) for NUMERIC */
type ParseTypeModifiers<Tokens extends TokensList, BaseTypeName extends string> =
	PeekToken<Tokens> extends TokenKey<"(">
		? SkipToken<Tokens> extends infer R0 extends TokensList
			? BaseTypeName extends "varchar" | "character varying" | "char"
				? ParseVarcharLength<R0> extends [infer R1 extends TokensList, infer Len extends number]
					? [R1, { type: BaseTypeName; arg: Len; nullable: false }]
					: never
				: BaseTypeName extends "numeric" | "decimal"
					? ParseNumericPrecisionScale<R0> extends [
							infer R1 extends TokensList,
							infer Arg extends { precision: number; scale: number },
						]
						? [R1, { type: BaseTypeName; arg: Arg; nullable: false }]
						: never
					: // Other parameterized types - skip the parens for now
						SkipBracketedUntil<R0, TokenKey<")">> extends [infer R1 extends TokensList, infer _]
						? [R1, { type: BaseTypeName; arg: null; nullable: false }]
						: never
			: never
		: [Tokens, { type: BaseTypeName; arg: null; nullable: false }]

/** Main entry point: parse SQL type and return SqlTypeShape */
export type ParseSqlType<Tokens extends TokensList> =
	CollectSqlTypeWords<Tokens> extends [infer AfterWords extends TokensList, infer Words extends readonly string[]]
		? Words extends readonly []
			? SkipFailedExpression<AfterWords, SqlParserError<"Expected type name">>
			: TypeWordsToString<Words> extends infer TypeName extends string
				? NormalizeSqlTypeName<TypeName> extends infer NormalizedName extends string
					? ParseTypeModifiers<AfterWords, NormalizedName> extends [
							infer AfterMods extends TokensList,
							infer BaseShape extends SqlTypeShape,
						]
						? ParseArraySuffix<AfterMods, BaseShape> extends [
								infer AfterArray extends TokensList,
								infer ArrayShape extends SqlTypeShape,
							]
							? ParseNullability<AfterArray, ArrayShape>
							: never
						: never
					: never
				: never
		: never
