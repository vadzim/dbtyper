/**
 * PGT-14: an enum is compared with, or assigned, only its own labels. The shapes alone (SameComparisonClass) cannot
 * tell a label from another string, so the checks also see the operand's AST: a string literal is looked up in the
 * enum's labels (read from the chain when used, so ALTER TYPE counts, PGT-13).
 */
import type { Errors, FormatError } from "../dbtyper-error.ts"
import type { JsqlEnumLabelUnion } from "../core/jsql-utils.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"

type EnumName<E extends SqlTypeShape> = E["arg"] extends readonly [infer N extends string, string] ? N : ""

/**
 * Another side of a comparison with / assignment to the enum `E`: the error when it is a string literal that is not
 * a label, else `true`. A value of another class (number, boolean, text, another enum) is the class check's error
 * (EXPR-26: one class per enum).
 */
type EnumAgainst<Db, E extends SqlTypeShape, OtherAst> = OtherAst extends {
	kind: "string"
	value: infer V extends string
}
	? [Db] extends [never]
		? true
		: V extends JsqlEnumLabelUnion<Db, E["arg"]>
			? true
			: FormatError<Errors["VALUE_NOT_IN_ENUM"], [V, EnumName<E>]>
	: true

/** `true`, or the error, for `L op R` when either side is an enum; `true` when none is. */
export type EnumComparisonCheck<
	Db,
	L extends SqlTypeShape,
	LAst,
	R extends SqlTypeShape,
	RAst,
> = L["type"] extends "enum" ? EnumAgainst<Db, L, RAst> : R["type"] extends "enum" ? EnumAgainst<Db, R, LAst> : true

/** The assignment of the value `ValAst` to a column of type `Col`. */
export type EnumAssignmentCheck<Db, Col extends SqlTypeShape, ValAst> = Col["type"] extends "enum"
	? EnumAgainst<Db, Col, ValAst>
	: true

/** A cast of `Ast` to the type `To`: a string literal cast to an enum must be one of its labels (PGT-14). */
export type EnumCastCheck<Db, To extends SqlTypeShape, Ast> = To["type"] extends "enum"
	? EnumAgainst<Db, To, Ast>
	: true

/** `Result`, or the enum error `Check` when it is one. */
export type WithEnumCheck<Check, Result> = Check extends true ? Result : Check

/** The functions whose arguments are compared with each other like `=` does (data, PGT-14). */
type PeerCheckedFunctions = "coalesce" | "nullif" | "greatest" | "least"

/** The first enum among resolved arguments, or `never`. */
type FirstEnumArg<Shapes extends readonly SqlTypeShape[]> = Shapes extends readonly [
	infer H extends SqlTypeShape,
	...infer T extends readonly SqlTypeShape[],
]
	? H["type"] extends "enum"
		? H
		: FirstEnumArg<T>
	: never

type EnumPeerWalk<Db, E extends SqlTypeShape, Asts extends readonly unknown[]> = Asts extends readonly [
	infer H,
	...infer T,
]
	? EnumAgainst<Db, E, H> extends infer C
		? C extends true
			? EnumPeerWalk<Db, E, T>
			: C
		: never
	: true

/** `COALESCE(enum, 'label', …)` and the like: a string literal next to an enum argument must be one of its labels. */
export type EnumPeerCheck<
	Db,
	Fn extends string,
	Shapes extends readonly SqlTypeShape[],
	Asts extends readonly unknown[],
> = Fn extends PeerCheckedFunctions
	? [FirstEnumArg<Shapes>] extends [never]
		? true
		: EnumPeerWalk<Db, FirstEnumArg<Shapes>, Asts>
	: true
