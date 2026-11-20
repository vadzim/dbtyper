/**
 * Comparison classes (EXPR-26, PGT-16): which SQL types may be compared, combined or assigned. Facts are data:
 * add a type name to {@link ComparisonClassOfType}, or a class to {@link StringLiteralClasses}; no parser condition.
 * This table is the one list of the numeric type names ("is it a number": class "numeric"); which of two numeric types
 * is the wider is the `numericOrder` fact of the dialect (src/core/dialect.ts).
 */
import type { SqlTypeShape } from "./sql-type-shape.ts"

/** The class of a (lower-case, non-array) SQL type name; a name that is not here is class "unknown" (compatible with all). */
type ComparisonClassOfType = {
	integer: "numeric"
	int: "numeric"
	int2: "numeric"
	int4: "numeric"
	int8: "numeric"
	smallint: "numeric"
	bigint: "numeric"
	real: "numeric"
	float4: "numeric"
	float8: "numeric"
	"double precision": "numeric"
	numeric: "numeric"
	decimal: "numeric"
	number: "numeric"
	float: "numeric"
	boolean: "boolean"
	bool: "boolean"
	text: "text"
	varchar: "text"
	"character varying": "text"
	char: "text"
	character: "text"
	bpchar: "text"
	name: "text"
	citext: "text"
	uuid: "uuid"
	date: "datetime"
	time: "datetime"
	timetz: "datetime"
	"time with time zone": "datetime"
	"time without time zone": "datetime"
	timestamp: "datetime"
	timestamptz: "datetime"
	"timestamp with time zone": "datetime"
	"timestamp without time zone": "datetime"
}

/** One class per enum (EXPR-26): its schema and name (`arg` of an enum shape, src/parser/parse-sql-type-words.ts). */
type EnumClass<S extends SqlTypeShape> = S["arg"] extends readonly [infer N extends string, infer Sc extends string]
	? `enum:${Sc}.${N}`
	: "enum:"

/**
 * The classes, besides text, that an untyped string literal fits without a cast (PGT-16); for an enum the literal
 * must also be one of its labels (PGT-14, src/parser/parse-enum-checks.ts). Types of class "unknown" (interval,
 * inet, json[b], …) take it anyway. A string literal against a numeric or boolean class stays an error.
 */
export type StringLiteralClasses = "uuid" | "datetime" | `enum:${string}`

/** The class of a SQL type name, an array of a class for `T[]`. */
export type SqlComparisonClass<Sql extends string> = Sql extends `${infer Base}[]`
	? `array_${SqlComparisonClass<Base>}`
	: Lowercase<Sql> extends keyof ComparisonClassOfType
		? ComparisonClassOfType[Lowercase<Sql>]
		: "unknown"

/** The class of a shape: its type name's class, or the class of its enum. */
export type ShapeComparisonClass<S extends SqlTypeShape> = S["type"] extends "enum"
	? EnumClass<S>
	: SqlComparisonClass<S["type"]>
