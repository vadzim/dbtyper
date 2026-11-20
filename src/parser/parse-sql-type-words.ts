import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenNumber, TokenType } from "../lexer/sql-lexer.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { SkipFailedExpression, SkipBracketedUntil } from "./skip-statement.ts"
import type { SqlTypeShape, NonNull } from "../core/sql-type-shape.ts"
import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { JsqlDbFindUserType } from "../core/jsql-utils.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { DialectColumnTypeName, NormalizeSqlTypeName } from "../core/dialect-types.ts"

/**
 * Collect type name words (e.g., "double", "precision" → ["double", "precision"]). With `Named` (a dialect whose
 * declared type name is the type, PostgreSQL) a word after the first one joins the name only where a known type name
 * of several words goes on ({@link TypeNameContinuations}), so `c int nut null` is an error at `nut`, not a type
 * `int nut` (#159). Without it every word joins (SQLite takes any words as the type name, SQLT-6).
 */
type CollectSqlTypeWords<
	Tokens extends ParserMonad,
	Acc extends readonly string[],
	Named extends boolean,
	Prefix extends string = "",
> =
	PeekToken<Tokens> extends TokenType<"ident" | "key", infer W extends string>
		? Lowercase<W> extends "collate"
			? [Tokens, Acc]
			: [Named, Prefix] extends [true, ""]
				? PeekToken<Tokens> extends TokenIdent<string>
					? CollectSqlTypeWords<SkipToken<Tokens>, [...Acc, W], Named, Lowercase<W>>
					: [Tokens, Acc]
				: Named extends true
					? Lowercase<W> extends ContinuationOf<Prefix>
						? CollectSqlTypeWords<SkipToken<Tokens>, [...Acc, W], Named, `${Prefix} ${Lowercase<W>}`>
						: [Tokens, Acc]
					: PeekToken<Tokens> extends TokenIdent<string>
						? CollectSqlTypeWords<SkipToken<Tokens>, [...Acc, W], Named, Prefix>
						: [Tokens, Acc]
		: [Tokens, Acc]

/** The fields of an interval type (PGT-8). */
type IntervalField = "year" | "month" | "day" | "hour" | "minute" | "second"

/** PostgreSQL type names of several words: the words that may follow the name read so far. */
type TypeNameContinuations = {
	double: "precision"
	character: "varying"
	char: "varying"
	bit: "varying"
	national: "character" | "char"
	"national character": "varying"
	"national char": "varying"
	timestamp: "with" | "without"
	time: "with" | "without"
	"timestamp with": "time"
	"timestamp without": "time"
	"time with": "time"
	"time without": "time"
	"timestamp with time": "zone"
	"timestamp without time": "zone"
	"time with time": "zone"
	"time without time": "zone"
	interval: IntervalField
	"interval year": "to"
	"interval year to": "month"
	"interval day": "to"
	"interval day to": "hour" | "minute" | "second"
	"interval hour": "to"
	"interval hour to": "minute" | "second"
	"interval minute": "to"
	"interval minute to": "second"
}

type ContinuationOf<Prefix extends string> = Prefix extends keyof TypeNameContinuations
	? TypeNameContinuations[Prefix]
	: never

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
type ParseTypeModifiersAndZone<Tokens extends ParserMonad, Name extends string, Named extends boolean> =
	ParseTypeModifiers<Tokens, Name> extends [infer R extends ParserMonad, infer Shape]
		? Shape extends SqlTypeShape
			? ParseZoneWords<R, PeekToken<Tokens> extends TokenKey<"("> ? true : false, Name, Shape, Named>
			: [R, Shape] // a bad modifier: the error
		: never

type ParseZoneWords<
	R extends ParserMonad,
	HadModifier extends boolean,
	Name extends string,
	Shape extends SqlTypeShape,
	Named extends boolean,
> = Name extends "timestamp" | "time"
	? HadModifier extends true
		? CollectSqlTypeWords<R, [], Named, Named extends true ? Name : "x"> extends [
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
	DialectFact<Db, "declaredTypes"> extends "named"
		? PeekToken<Tokens> extends TokenIdent<infer Q extends string>
			? Lowercase<Q> extends "collate"
				? ParseUnqualifiedSqlType<Tokens, Db, KeepDeclared, Schema, true>
				: SkipToken<Tokens> extends infer R1 extends ParserMonad
					? PeekToken<R1> extends TokenKey<".">
						? // PGT-13: `schema.type` (`app.status`): the schema says where a named type is looked up
							ParseSqlType<SkipToken<R1>, Db, KeepDeclared, Q>
						: ParseUnqualifiedSqlType<R1, Db, KeepDeclared, Schema, true, [Q], Lowercase<Q>>
					: never
			: ParseUnqualifiedSqlType<Tokens, Db, KeepDeclared, Schema, true>
		: ParseUnqualifiedSqlType<Tokens, Db, KeepDeclared, Schema, false>

/** The type words (the first ones may be read already, `Words0`) and what follows them. */
type ParseUnqualifiedSqlType<
	Tokens extends ParserMonad,
	Db,
	KeepDeclared extends boolean,
	Schema extends string,
	Named extends boolean,
	Words0 extends readonly string[] = [],
	Prefix0 extends string = "",
> =
	CollectSqlTypeWords<Tokens, Words0, Named, Prefix0> extends [
		infer AfterWords extends ParserMonad,
		infer Words extends readonly string[],
	]
		? Words extends readonly []
			? SkipFailedExpression<AfterWords, FormatError<Errors["EXPECTED_TYPE_NAME"], [""]>>
			: WithoutIntervalFields<TypeWordsToString<Words>> extends infer TypeName extends string
				? DialectColumnTypeName<Db, TypeName> extends infer NormalizedName extends string
					? ParseTypeModifiersAndZone<AfterWords, NormalizedName, Named> extends [
							infer AfterMods extends ParserMonad,
							infer BaseShape0,
						]
						? BaseShape0 extends SqlTypeShape
							? ResolveUserType<Db, Schema, BaseShape0> extends [
									infer BaseShape extends SqlTypeShape,
									infer DomainNn extends boolean,
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
													? [R, Shaped & { declared: TypeName }]
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
 * used, so ALTER TYPE changes them) or its domain's base type; the second item says a domain NOT NULL applies.
 * Only PostgreSQL chains have named types; a name with parameters or no match stays as parsed.
 */
export type ResolveUserType<Db, Schema extends string, Base extends SqlTypeShape> =
	DialectFact<Db, "declaredTypes"> extends "affinity"
		? [Base, false]
		: Db extends JsqlDatabaseShape
			? Base["arg"] extends null
				? JsqlDbFindUserType<Db, Schema, Base["type"]> extends infer Found
					? [Found] extends [never]
						? [Base, false]
						: Found extends { schema: infer S extends string; type: infer T }
							? T extends { kind: "enum" }
								? [{ type: "enum"; arg: readonly [Base["type"], S]; nullable: false }, false]
								: T extends {
											kind: "domain"
											base: infer B extends SqlTypeShape
											notNull: infer N extends boolean
									  }
									? [B, N]
									: [Base, false]
							: [Base, false]
					: never
				: [Base, false]
			: [Base, false]

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
