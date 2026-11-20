import type { DialectCastRow, PgOnlyTypeError } from "../core/dialect-types.ts"
import type { SqlArray, SqlNull, SqlText, SqlType, SqlTypeShape } from "../core/sql-type-shape.ts"
import type { Errors, FormatError } from "../dbtyper-error.ts"
import type { EnumCastCheck, WithEnumCheck } from "./parse-enum-checks.ts"
import type { ResolveUserType } from "./parse-sql-type-words.ts"

/**
 * The written type name of a cast, lower-case, its words joined by one space. PGT-12 (#163): each `[]` after the name
 * (a `"[]"` part) is kept as a `[]` suffix.
 */
export type SqlCastTypeNorm<P extends readonly string[]> = P extends readonly [
	infer H extends string,
	...infer T extends readonly string[],
]
	? T extends readonly []
		? Lowercase<H>
		: H extends `${string}.`
			? `${Lowercase<H>}${SqlCastTypeNorm<T>}` // `schema.type`: the dot joins without a space
			: T extends readonly ["[]", ...string[]]
				? `${Lowercase<H>}${SqlCastTypeNorm<T>}`
				: `${Lowercase<H>} ${SqlCastTypeNorm<T>}`
	: string

/** SQLT-53: `CAST(x AS jsonb)` in a SQLite chain names the PostgreSQL-only type. */
export type CastPgOnlyTypeError<Db, Parts extends readonly string[]> = PgOnlyTypeError<Db, SqlCastTypeNorm<Parts>>

/** PGT-14: a string literal cast to an enum must be one of its labels; `Cast` otherwise. */
export type WithCastLabelCheck<Db, Cast, Ast> = Cast extends SqlTypeShape
	? WithEnumCheck<EnumCastCheck<Db, Cast, Ast>, Cast>
	: Cast

/**
 * `CAST` / `::` result typing for SqlTypeShape: one rule over the type-name table of the chain's dialect (DLCT-5,
 * {@link DialectCastRow}); SQLT-6, SQLT-12: where the names only decide an affinity, the cast gives that affinity's type.
 */
export type ResolveCastForDialect<Db, Ev extends SqlTypeShape, N extends string> = N extends `${infer Element}[]`
	? CastToArray<ResolveCastForDialect<Db, ArrayCastSource<Ev>, Element>>
	: N extends `${infer Sch}.${infer Tn}`
		? CastToNamedType<Db, Ev, Sch, Tn>
		: CastToNamedType<Db, Ev, DefaultSchemaOf<Db>, N>

/** PGT-12 (#163): a cast to `T[]` is an array of what a cast to `T` gives. */
type CastToArray<Element> = Element extends SqlTypeShape
	? Element["type"] extends "null"
		? SqlNull
		: SqlArray<Element>
	: Element

/** The value an element cast is checked against: the element of an array value, text (a literal `'{…}'`) otherwise. */
type ArrayCastSource<Ev extends SqlTypeShape> = Ev["type"] extends "null"
	? Ev
	: Ev extends { type: "array"; arg: infer Element extends SqlTypeShape }
		? Element
		: SqlText

/** The type a cast to the written name gives a parameter (CORE-6): the built-in cast row, an array of it for `T[]`. */
export type CastTargetShape<Db, Ev extends SqlTypeShape, N extends string> = N extends `${infer Element}[]`
	? CastToArray<CastTargetShape<Db, Ev, Element>>
	: ResolveCastFromShape<Db, Ev, N>

/** PGT-13, PGT-22: a cast to a type name: an enum or a domain of the chain, else the dialect's built-in type. */
type CastToNamedType<Db, Ev extends SqlTypeShape, Schema extends string, N extends string> =
	ResolveUserType<Db, Schema, SqlType<N>> extends [infer U extends SqlTypeShape, boolean]
		? U["type"] extends N
			? ResolveCastFromShape<Db, Ev, N>
			: U
		: ResolveCastFromShape<Db, Ev, N>

type DefaultSchemaOf<Db> = Db extends { defaultSchema: infer D extends string } ? D : ""

/** The built-in cast of a value to a written type name: the row of the dialect's table, its guard against the value. */
type ResolveCastFromShape<Db, Ev extends SqlTypeShape, N extends string> = Ev["type"] extends "null"
	? SqlNull
	: DialectCastRow<Db, N> extends [infer T extends string, infer Guard extends string]
		? Guard extends "no-boolean"
			? Ev["type"] extends "boolean"
				? FormatError<Errors["CANNOT_CAST_BOOLEAN_TO_INTEGER"], []>
				: SqlType<T>
			: Guard extends "no-number"
				? Ev["type"] extends "integer" | "bigint" | "numeric"
					? FormatError<Errors["CANNOT_CAST_INTEGER_TO_BOOLEAN"], []>
					: SqlType<T>
				: SqlType<T>
		: never

/** True when a cast to the written type name gives text (a cast to a text type is a non-numeric head of `*`). */
export type CastGivesText<Db, N extends string> = DialectCastRow<Db, N>[0] extends "text" ? true : false
