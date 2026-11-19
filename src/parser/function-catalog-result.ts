import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { Nullable, SqlArray, SqlTypeShape, NonNull } from "../core/sql-type-shape.ts"

/**
 * The result of a catalog row: the result codes of the row grammar (see function-catalog.ts) and the nullability
 * names, one grammar for every dialect; the dialect only picks the widening and `sum` rules.
 */

type Numeric = "integer" | "real" | "numeric" | "boolean" | "bigint"

/** SQLite: the common type of two argument types; equal types stay, numbers widen, otherwise `any`. */
type AffinityCommon2<A extends string, B extends string> = A extends B
	? A
	: [A | B] extends [Numeric]
		? "real" extends A | B
			? "real"
			: "numeric" extends A | B
				? "numeric"
				: "integer"
		: "any"

type PgNumeric = "smallint" | "integer" | "bigint" | "numeric" | "real" | "double precision"

/** PostgreSQL: the widest numeric type among the two (its numeric hierarchy); other types keep the first. */
type TypedCommon2<A extends string, B extends string> = A extends B
	? A
	: [A | B] extends [PgNumeric]
		? "double precision" extends A | B
			? "double precision"
			: "real" extends A | B
				? "real"
				: "numeric" extends A | B
					? "numeric"
					: "bigint" extends A | B
						? "bigint"
						: "integer"
		: A

type Common2<C extends string, A extends string, B extends string> = C extends "affinity"
	? AffinityCommon2<A, B>
	: TypedCommon2<A, B>

/** Common type of argument types: null literals are ignored; the dialect's widening decides the rest. */
type CommonType<
	C extends string,
	Args extends readonly SqlTypeShape[],
	Acc extends string = never,
> = Args extends readonly [infer H extends SqlTypeShape, ...infer T extends readonly SqlTypeShape[]]
	? H["type"] extends "null"
		? CommonType<C, T, Acc>
		: [Acc] extends [never]
			? CommonType<C, T, H["type"]>
			: CommonType<C, T, Common2<C, Acc, H["type"]>>
	: [Acc] extends [never]
		? "null"
		: Acc

/** The type name that stands for "any type" in the dialect's type map (`arg` without arguments). */
type UnknownTypeName<C extends string> = C extends "affinity" ? "any" : "unknown"

type FirstValue<Args extends readonly SqlTypeShape[]> = Args extends readonly [
	infer H extends SqlTypeShape,
	...infer T extends readonly SqlTypeShape[],
]
	? H["type"] extends "null"
		? FirstValue<T>
		: H
	: { type: "null"; arg: null; nullable: true }

/** `sum`: SQLite integer over integers, else real; PostgreSQL (PGT-27) smallint/integer to bigint, bigint/numeric to numeric, floats keep their type. */
type SumType<C extends string, T extends string> = C extends "affinity"
	? T extends "integer" | "boolean" | "bigint"
		? "integer"
		: "real"
	: T extends "smallint" | "integer"
		? "bigint"
		: T extends "real" | "double precision"
			? T
			: "numeric"

/** PGT-27: `avg` over integers and numeric is numeric, over floats double precision. */
type AvgType<T extends string> = T extends "real" | "double precision" ? "double precision" : "numeric"

type FirstArg<C extends string, Args extends readonly SqlTypeShape[]> = Args extends readonly [
	infer A extends SqlTypeShape,
	...unknown[],
]
	? A
	: Shape<UnknownTypeName<C>>

type ResultShape<C extends string, R extends string, Args extends readonly SqlTypeShape[]> = R extends "arg"
	? NonNull<FirstArg<C, Args>>
	: R extends "arg2"
		? Args extends readonly [unknown, infer A extends SqlTypeShape, ...unknown[]]
			? NonNull<A>
			: Shape<UnknownTypeName<C>>
		: R extends "common"
			? Shape<CommonType<C, Args>>
			: R extends "common-tail"
				? Shape<CommonType<C, Tail<Args>>>
				: R extends "first-value"
					? FirstValue<Args> extends infer F extends SqlTypeShape
						? NonNull<F>
						: never
					: R extends "sum"
						? Shape<SumType<C, FirstArg<C, Args>["type"]>>
						: R extends "avg"
							? Shape<AvgType<FirstArg<C, Args>["type"]>>
							: R extends "array-of-arg"
								? SqlArray<NonNull<FirstArg<C, Args>>>
								: R extends "text[]"
									? SqlArray<Shape<"text">>
									: R extends "array-length" | "array-append" | "array-prepend" | "unnest"
										? PgArrayFunctionResult<R, Args>
										: Shape<R>

/** The result of a row of dialect `C` for resolved argument types (CORE-2 per the row). */
export type CatalogRowResult<C extends string, Row, Args extends readonly SqlTypeShape[]> = Row extends readonly [
	infer R extends string,
	infer N extends string,
	...unknown[],
]
	? ResultShape<C, R, Args> extends infer S
		? S extends DbtyperErrorShape
			? S
			: S extends SqlTypeShape
				? IsResultNullable<N, Args> extends true
					? Nullable<S>
					: S
				: never
		: never
	: never

type Shape<T extends string> = { type: T; arg: null; nullable: false }

type Tail<Args extends readonly SqlTypeShape[]> = Args extends readonly [
	unknown,
	...infer T extends readonly SqlTypeShape[],
]
	? T
	: readonly []

type AnyNullable<Args extends readonly SqlTypeShape[]> = Args extends readonly [
	infer H extends SqlTypeShape,
	...infer T extends readonly SqlTypeShape[],
]
	? H["nullable"] extends true
		? true
		: AnyNullable<T>
	: false

type AllNullable<Args extends readonly SqlTypeShape[]> = Args extends readonly [
	infer H extends SqlTypeShape,
	...infer T extends readonly SqlTypeShape[],
]
	? H["nullable"] extends true
		? AllNullable<T>
		: false
	: true

/** CORE-2 for one row: is the result nullable, given the argument types. */
type IsResultNullable<N extends string, Args extends readonly SqlTypeShape[]> = N extends "non-null"
	? false
	: N extends "null"
		? true
		: N extends "all"
			? Args extends readonly []
				? false
				: AllNullable<Args>
			: N extends "tail"
				? AnyNullable<Tail<Args>>
				: N extends "first"
					? Args extends readonly [infer F extends SqlTypeShape, ...unknown[]]
						? F["nullable"]
						: false
					: N extends "lag"
						? Args extends readonly [SqlTypeShape, SqlTypeShape, infer D extends SqlTypeShape]
							? D["nullable"] extends true
								? true
								: AnyNullable<Args>
							: true
						: AnyNullable<Args>

/** FN-19…FN-21: the array functions check their argument types (the argument count is the row's arity). */
type PgArrayFunctionResult<R extends string, Args extends readonly SqlTypeShape[]> = R extends "array-length"
	? Args extends readonly [infer S1 extends SqlTypeShape, SqlTypeShape]
		? S1["type"] extends "array" | "unknown"
			? Shape<"integer">
			: FormatError<Errors["ARRAY_LENGTH_EXPECTS_ARRAY_INTEGER"], []>
		: never
	: R extends "array-append"
		? Args extends readonly [infer S1 extends SqlTypeShape, SqlTypeShape]
			? S1["type"] extends "array" | "unknown"
				? S1
				: FormatError<Errors["ARRAY_APPEND_EXPECTS_ARRAY_ELEMENT"], []>
			: never
		: R extends "array-prepend"
			? Args extends readonly [SqlTypeShape, infer S2 extends SqlTypeShape]
				? S2["type"] extends "array" | "unknown"
					? S2
					: FormatError<Errors["ARRAY_PREPEND_EXPECTS_ELEMENT_ARRAY"], []>
				: never
			: Args extends readonly [infer S1 extends SqlTypeShape]
				? S1 extends { type: "array"; arg: infer E extends SqlTypeShape }
					? E
					: S1["type"] extends "array" | "unknown"
						? Shape<"unknown">
						: FormatError<Errors["UNNEST_EXPECTS_AN_ARRAY"], []>
				: never
