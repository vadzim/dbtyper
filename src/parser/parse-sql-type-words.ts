import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenNumber, TokenType } from "../lexer/sql-lexer.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { SkipFailedExpression, SkipBracketedUntil } from "./skip-statement.ts"
import type { SqlTypeShape, SqlType, NonNull } from "../core/sql-type-shape.ts"
import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { JsqlDbFindUserType } from "../core/jsql-utils.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { DialectColumnTypeName, NormalizeSqlTypeName } from "../core/dialect-types.ts"

/**
 * Collect type name words (e.g., "double", "precision" → ["double", "precision"]) by the dialect's `typeNameWords`
 * fact (`Words`): with a table (PostgreSQL) a word after the first one joins the name only where a known type name
 * of several words goes on, so `c int nut null` is an error at `nut`, not a type `int nut` (#159). With "any" every
 * identifier joins (SQLite takes any words as the type name, SQLT-6).
 */
type CollectSqlTypeWords<Tokens extends ParserMonad, Acc extends readonly string[], Words, Prefix extends string = ""> =
	PeekToken<Tokens> extends TokenType<"ident" | "key", infer W extends string>
		? Lowercase<W> extends "collate"
			? [Tokens, Acc]
			: Prefix extends ""
				? PeekToken<Tokens> extends TokenIdent<string>
					? CollectSqlTypeWords<SkipToken<Tokens>, [...Acc, W], Words, Lowercase<W>>
					: [Tokens, Acc]
				: Words extends "any"
					? PeekToken<Tokens> extends TokenIdent<string>
						? CollectSqlTypeWords<SkipToken<Tokens>, [...Acc, W], Words, Prefix>
						: [Tokens, Acc]
					: Lowercase<W> extends ContinuationOf<Words, Prefix>
						? CollectSqlTypeWords<SkipToken<Tokens>, [...Acc, W], Words, `${Prefix} ${Lowercase<W>}`>
						: [Tokens, Acc]
		: [Tokens, Acc]

type ContinuationOf<Words, Prefix extends string> = Prefix extends keyof Words ? Words[Prefix] : never

/** PGT-8: the fields of an interval (`interval day to second`) do not change its type. */
type WithoutIntervalFields<Name extends string> = Name extends `interval ${string}` ? "interval" : Name

/** Convert type words to lowercase space-separated string */
type TypeWordsToString<A extends readonly string[]> = A extends readonly [
	infer H extends string,
	...infer T extends readonly string[],
]
	? T extends readonly []
		? Lowercase<H>
		: `${Lowercase<H>} ${TypeWordsToString<T>}`
	: ""

/** Parse numeric literal from token string */
type ParseNumericLiteral<S extends string> = S extends `${infer N extends number}` ? N : never

/** Parse array suffix `[]` after a type, returning SqlTypeShape with array wrapper */
type ParseArraySuffix<Tokens extends ParserMonad, BaseType extends SqlTypeShape> =
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
type ParseNullability<Tokens extends ParserMonad, BaseType extends SqlTypeShape> =
	PeekToken<Tokens> extends TokenKey<"not">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"null">
				? [SkipToken<R1>, NonNull<BaseType>]
				: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_NULL_AFTER_NOT"], []>>
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
				? ParseVarcharLength<R0> extends [infer R1 extends ParserMonad, infer Len]
					? Len extends number
						? [R1, { type: BaseTypeName; arg: Len; nullable: false }]
						: [R1, Len]
					: never
				: BaseTypeName extends "numeric" | "decimal"
					? ParseNumericPrecisionScale<R0> extends [infer R1 extends ParserMonad, infer Arg]
						? Arg extends { precision: number; scale: number }
							? [R1, { type: BaseTypeName; arg: Arg; nullable: false }]
							: [R1, Arg]
						: never
					: // Other parameterized types, e.g. time(3): the argument does not change the TypeScript type, so it is skipped (arg: null)
						SkipBracketedUntil<R0, TokenKey<")">> extends [infer R1 extends ParserMonad, infer _]
						? [SkipToken<R1>, { type: BaseTypeName; arg: null; nullable: false }]
						: never
			: never
		: [Tokens, { type: BaseTypeName; arg: null; nullable: false }]

/** `timestamp(3) with time zone`: words after the modifier of timestamp/time (TYPE-4) */
type ParseTypeModifiersAndZone<Tokens extends ParserMonad, Name extends string, Words> =
	ParseTypeModifiers<Tokens, Name> extends [infer R extends ParserMonad, infer Shape]
		? Shape extends SqlTypeShape
			? ParseZoneWords<R, PeekToken<Tokens> extends TokenKey<"("> ? true : false, Name, Shape, Words>
			: [R, Shape] // a bad modifier: the error
		: never

type ParseZoneWords<
	R extends ParserMonad,
	HadModifier extends boolean,
	Name extends string,
	Shape extends SqlTypeShape,
	Words,
> = Name extends "timestamp" | "time"
	? HadModifier extends true
		? CollectSqlTypeWords<R, [], Words, Name> extends [
				infer R2 extends ParserMonad,
				infer Extra extends readonly string[],
			]
			? Extra extends readonly []
				? [R2, Shape]
				: NormalizeSqlTypeName<`${Name} ${TypeWordsToString<Extra>}`> extends infer N extends string
					? [R2, { type: N; arg: null; nullable: false }]
					: never
			: never
		: [R, Shape]
	: [R, Shape]

/**
 * Main entry point: parse SQL type and return SqlTypeShape. With `KeepDeclared` the shape also says the lower-case
 * declared type name (`declared`; STRICT and the rowid alias of SQLite need it, SQLT-11, SQLT-13), which the caller
 * strips again: it is not part of a column type.
 */
export type ParseSqlType<
	Tokens extends ParserMonad,
	Db,
	KeepDeclared extends boolean = false,
	Schema extends string = Db extends { defaultSchema: infer D extends string } ? D : "",
> =
	DialectFact<Db, "userTypes"> extends true
		? PeekToken<Tokens> extends TokenIdent<infer Q extends string>
			? Lowercase<Q> extends "collate"
				? ParseUnqualifiedSqlType<Tokens, Db, KeepDeclared, Schema>
				: SkipToken<Tokens> extends infer R1 extends ParserMonad
					? PeekToken<R1> extends TokenKey<".">
						? // PGT-13: `schema.type` (`app.status`): the schema says where a named type is looked up
							ParseSqlType<SkipToken<R1>, Db, KeepDeclared, Q>
						: ParseUnqualifiedSqlType<R1, Db, KeepDeclared, Schema, [Q], Lowercase<Q>>
					: never
			: ParseUnqualifiedSqlType<Tokens, Db, KeepDeclared, Schema>
		: ParseUnqualifiedSqlType<Tokens, Db, KeepDeclared, Schema>

/** The type words (the first ones may be read already, `Words0`) and what follows them. */
type ParseUnqualifiedSqlType<
	Tokens extends ParserMonad,
	Db,
	KeepDeclared extends boolean,
	Schema extends string,
	Words0 extends readonly string[] = [],
	Prefix0 extends string = "",
> =
	CollectSqlTypeWords<Tokens, Words0, DialectFact<Db, "typeNameWords">, Prefix0> extends [
		infer AfterWords extends ParserMonad,
		infer Words extends readonly string[],
	]
		? Words extends readonly []
			? SkipFailedExpression<AfterWords, FormatError<Errors["EXPECTED_TYPE_NAME"], [""]>>
			: WithoutIntervalFields<TypeWordsToString<Words>> extends infer TypeName extends string
				? DialectColumnTypeName<Db, TypeName> extends infer NormalizedName extends string
					? ParseTypeModifiersAndZone<AfterWords, NormalizedName, DialectFact<Db, "typeNameWords">> extends [
							infer AfterMods extends ParserMonad,
							infer BaseShape0,
						]
						? BaseShape0 extends SqlTypeShape
							? ResolveUserType<Db, Schema, BaseShape0> extends [
									infer BaseShape extends SqlTypeShape,
									infer DomainNn extends boolean,
									infer UserDecl extends string,
								]
								? ParseArraySuffix<AfterMods, BaseShape> extends [
										infer AfterArray extends ParserMonad,
										infer ArrayShape,
									]
									? ArrayShape extends SqlTypeShape
										? KeepDeclared extends true
											? ParseNullabilityOfDomain<AfterArray, ArrayShape, DomainNn> extends [
													infer R extends ParserMonad,
													infer Shaped,
												]
												? Shaped extends SqlTypeShape
													? [
															R,
															Shaped & {
																declared: [UserDecl] extends [never]
																	? TypeName
																	: UserDecl
															},
														]
													: [R, Shaped]
												: never
											: ParseNullabilityOfDomain<AfterArray, ArrayShape, DomainNn>
										: [AfterArray, ArrayShape] // `[` without `]`: the error
									: never
								: never
							: [AfterMods, BaseShape0] // a bad modifier: the error
						: never
					: DialectColumnTypeName<Db, TypeName> extends infer TypeErr extends DbtyperErrorShape
						? SkipFailedExpression<AfterWords, TypeErr>
						: never
				: never
		: never

/**
 * PGT-13, PGT-22: a declared name that is a type of the chain is its enum shape (labels are looked up when the shape is
 * used, so ALTER TYPE changes them) or its domain's base type; the second item says a domain NOT NULL applies. The
 * third is `schema.name` of a domain or composite type, `never` otherwise: the column keeps it as its declared name
 * (the type no longer names it), so DROP DOMAIN / DROP TYPE finds the columns that use it (TYPE-18, #179).
 * Only PostgreSQL chains have named types; a name with parameters or no match stays as parsed.
 */
export type ResolveUserType<Db, Schema extends string, Base extends SqlTypeShape> =
	DialectFact<Db, "userTypes"> extends false
		? [Base, false, never]
		: Db extends JsqlDatabaseShape
			? Base["arg"] extends null
				? JsqlDbFindUserType<Db, Schema, Base["type"]> extends infer Found
					? [Found] extends [never]
						? [Base, false, never]
						: Found extends { schema: infer S extends string; type: infer T }
							? T extends { kind: "enum" }
								? [SqlType<"enum", readonly [Base["type"], S]>, false, never]
								: T extends {
											kind: "domain"
											base: infer B extends SqlTypeShape
											notNull: infer N extends boolean
									  }
									? [B, N, `${S}.${Base["type"]}`]
									: T extends { kind: "composite" }
										? [Base, false, `${S}.${Base["type"]}`]
										: [Base, false, never]
							: [Base, false, never]
					: never
				: [Base, false, never]
			: [Base, false, never]

/** {@link ParseNullability}, and a domain's NOT NULL makes the column NOT NULL (not for arrays: it is about the elements). */
type ParseNullabilityOfDomain<Tokens extends ParserMonad, Shape extends SqlTypeShape, DomainNn extends boolean> =
	ParseNullability<Tokens, Shape> extends [infer R extends ParserMonad, infer Sh]
		? Shape["type"] extends "array"
			? [R, Sh]
			: DomainNn extends true
				? Sh extends SqlTypeShape
					? [R, NonNull<Sh>]
					: [R, Sh]
				: [R, Sh]
		: never

/**
 * Words-only entry point (CAST and `::`, #180): the written type name, read by the same word rule as a column type
 * ({@link CollectSqlTypeWords} with the dialect's `typeNameWords`), as written words: a `schema.` prefix is one word
 * `schema.`, a `(…)` modifier is stepped over (it does not change the TypeScript type), after it the zone words of
 * `timestamp(3) with time zone`, then one `"[]"` per array dimension (#163; a size, `int[3]`, is not read:
 * PostgreSQL ignores it too). No type map is applied: the cast resolver applies the dialect once (DLCT-5).
 * An empty list when no type name follows (the caller names where one was expected).
 */
export type ParseSqlTypeNameWords<Tokens extends ParserMonad, Db> =
	PeekToken<Tokens> extends TokenIdent<infer Q extends string>
		? Lowercase<Q> extends "collate"
			? [Tokens, readonly []]
			: SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<".">
					? TypeNameWordsAfterSchema<SkipToken<R1>, Db, `${Q}.`>
					: TypeNameWordsAfterFirst<R1, Db, readonly [], [Q], Lowercase<Q>>
				: never
		: [Tokens, readonly []]

type TypeNameWordsAfterSchema<Tokens extends ParserMonad, Db, Schema extends string> =
	PeekToken<Tokens> extends TokenIdent<infer Q extends string>
		? TypeNameWordsAfterFirst<SkipToken<Tokens>, Db, readonly [Schema], [Q], Lowercase<Q>>
		: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_TYPE_NAME"], [""]>>

type TypeNameWordsAfterFirst<
	Tokens extends ParserMonad,
	Db,
	Schema extends readonly string[],
	First extends readonly string[],
	Prefix extends string,
> =
	CollectSqlTypeWords<Tokens, First, DialectFact<Db, "typeNameWords">, Prefix> extends [
		infer R extends ParserMonad,
		infer Words extends readonly string[],
	]
		? PeekToken<R> extends TokenKey<"(">
			? SkipBracketedUntil<SkipToken<R>, TokenKey<")">> extends [infer R2 extends ParserMonad, infer Rs]
				? Rs extends DbtyperErrorShape
					? SkipFailedExpression<R2, Rs>
					: TypeWordsToString<Words> extends "timestamp" | "time"
						? CollectSqlTypeWords<
								SkipToken<R2>,
								Words,
								DialectFact<Db, "typeNameWords">,
								TypeWordsToString<Words>
							> extends [infer R3 extends ParserMonad, infer Zoned extends readonly string[]]
							? TypeNameArraySuffix<R3, readonly [...Schema, ...Zoned]>
							: never
						: TypeNameArraySuffix<SkipToken<R2>, readonly [...Schema, ...Words]>
				: never
			: TypeNameArraySuffix<R, readonly [...Schema, ...Words]>
		: never

/** `[]` after a cast type name (#163): one `"[]"` word per pair, so `int[][]` is `["int", "[]", "[]"]`. */
type TypeNameArraySuffix<Tokens extends ParserMonad, Words extends readonly string[]> =
	PeekToken<Tokens> extends TokenKey<"[">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"]">
				? TypeNameArraySuffix<SkipToken<R1>, readonly [...Words, "[]"]>
				: SkipFailedExpression<
						R1,
						FormatError<Errors["EXPECTED_CLOSE_BRACKET_AFTER_OPEN_BRACKET_IN_ARRAY_TYPE"], []>
					>
			: never
		: [Tokens, Words]
