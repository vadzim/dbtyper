/**
 * Core SQL type shape - replaces string-based type representation.
 *
 * All SQL types are now represented as structured objects with:
 * - type: the base type name (lowercase, space-separated)
 * - arg: type-specific argument (null for simple types, number for VARCHAR(n), nested shape for arrays, etc.)
 * - nullable: whether the type allows NULL values
 */
export type SqlTypeShape = {
	type: string
	arg: unknown
	nullable: boolean
}

/**
 * Helper constructors for common types
 */

/** Create a non-nullable SQL type */
export type SqlType<T extends string, A = null> = {
	type: T
	arg: A
	nullable: false
}

/** Make a type NOT NULL (the counterpart of {@link Nullable}) */
export type NonNull<T extends SqlTypeShape> = {
	type: T["type"]
	arg: T["arg"]
	nullable: false
}

/** Make a type nullable */
export type Nullable<T extends SqlTypeShape> = {
	type: T["type"]
	arg: T["arg"]
	nullable: true
}

/**
 * Common type constants
 */

export type SqlText = SqlType<"text">
export type SqlInteger = SqlType<"integer">
export type SqlBigint = SqlType<"bigint">
export type SqlBoolean = SqlType<"boolean">
export type SqlNumeric = SqlType<"numeric">
export type SqlUuid = SqlType<"uuid">
export type SqlNull = { type: "null"; arg: null; nullable: true }
export type SqlUnknown = SqlType<"unknown">

/**
 * Array type constructor
 */
export type SqlArray<Element extends SqlTypeShape> = {
	type: "array"
	arg: Element
	nullable: false
}
