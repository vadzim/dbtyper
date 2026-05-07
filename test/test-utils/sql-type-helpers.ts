/**
 * Helper types for creating SqlTypeShape objects in tests.
 * These make it easier to define test database schemas.
 */

import type { SqlTypeShape } from "../../src/core/sql-type-shape.ts"

/** Create a non-nullable SQL type */
export type T<TypeName extends string, Arg = null> = {
	type: TypeName
	arg: Arg
	nullable: false
}

/** Create a nullable SQL type */
export type TNull<TypeName extends string, Arg = null> = {
	type: TypeName
	arg: Arg
	nullable: true
}

/** Common non-nullable types */
export type TText = T<"text">
export type TInteger = T<"integer">
export type TBigint = T<"bigint">
export type TBoolean = T<"boolean">
export type TNumeric = T<"numeric">
export type TUuid = T<"uuid">
export type TTimestamp = T<"timestamp with time zone">
export type TDate = T<"date">
export type TUnknown = T<"unknown">

/** PostgreSQL-specific types */
export type TSerial = T<"serial">
export type TBigserial = T<"bigserial">
export type TSmallserial = T<"smallserial">
export type TTimestamptz = T<"timestamptz">
export type TTimetz = T<"timetz">
export type TBytea = T<"bytea">
export type TInterval = T<"interval">
export type TInet = T<"inet">
export type TCidr = T<"cidr">
export type TTsvector = T<"tsvector">
export type TTsquery = T<"tsquery">

/** Array type constructor */
export type TArray<Element extends SqlTypeShape> = T<"array", Element>

/** Common array types */
export type TTextArray = TArray<TText>
export type TIntegerArray = TArray<TInteger>
export type TBigintArray = TArray<TBigint>
export type TBooleanArray = TArray<TBoolean>
export type TNumericArray = TArray<TNumeric>
export type TUuidArray = TArray<TUuid>

/** Varchar with length */
export type TVarchar<Length extends number> = T<"varchar", Length>

/** Numeric with precision and scale */
export type TNumericPS<Precision extends number, Scale extends number = 0> = T<
	"numeric",
	{ precision: Precision; scale: Scale }
>
