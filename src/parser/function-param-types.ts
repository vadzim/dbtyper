import type { SqlInteger, SqlText, SqlTypeShape } from "../core/sql-type-shape.ts"

/**
 * CORE-6: the SQL type a parameter gets as the argument of a function, by function name and argument position.
 * A row is data: add a function here, not a condition in the resolver. Functions whose argument type follows the
 * other arguments are in {@link PeerTypedFunctions}.
 */
type FunctionArgTypes = {
	lower: readonly [SqlText]
	upper: readonly [SqlText]
	initcap: readonly [SqlText]
	trim: readonly [SqlText]
	btrim: readonly [SqlText, SqlText]
	ltrim: readonly [SqlText, SqlText]
	rtrim: readonly [SqlText, SqlText]
	length: readonly [SqlText]
	char_length: readonly [SqlText]
	character_length: readonly [SqlText]
	reverse: readonly [SqlText]
	md5: readonly [SqlText]
	replace: readonly [SqlText, SqlText, SqlText]
	starts_with: readonly [SqlText, SqlText]
	strpos: readonly [SqlText, SqlText]
	instr: readonly [SqlText, SqlText]
	unicode: readonly [SqlText]
	left: readonly [SqlText, SqlInteger]
	right: readonly [SqlText, SqlInteger]
	substr: readonly [SqlText, SqlInteger, SqlInteger]
	substring: readonly [SqlText, SqlInteger, SqlInteger]
	lpad: readonly [SqlText, SqlInteger, SqlText]
	rpad: readonly [SqlText, SqlInteger, SqlText]
	repeat: readonly [SqlText, SqlInteger]
}

/** Functions whose arguments all share one type: a parameter takes the type of another argument. */
export type PeerTypedFunctions = "coalesce" | "ifnull" | "nullif" | "greatest" | "least" | "max" | "min"

/** The type of argument `Index` of function `Name`, or `never` when the position gives none. */
export type FunctionArgType<Name extends string, Index extends number> = Name extends keyof FunctionArgTypes
	? FunctionArgTypes[Name] extends infer Row
		? `${Index}` extends keyof Row
			? Row[`${Index}` & keyof Row] extends infer S extends SqlTypeShape
				? S
				: never
			: never
		: never
	: never
