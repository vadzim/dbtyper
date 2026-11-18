/**
 * SQL to TypeScript type conversion utilities.
 *
 * This module contains all logic for converting SQL type strings to TypeScript types.
 * It should ONLY be imported by sql-database.ts.
 *
 * DO NOT import this module anywhere else - not in parsers, not in sql-query.ts, nowhere except sql-database.ts.
 */

import type { DriverConfig } from "./sql-database.ts"
import type { SqlTypeShape } from "./sql-type-shape.ts"
import type { Errors, FormatError } from "../dbtyper-error.ts"
import type { Dialects } from "./dialect.ts"
import type { JsqlEnumLabelUnion } from "./jsql-utils.ts"

/**
 * Maps a SqlTypeShape to its corresponding TypeScript type using the scalarTypes map.
 *
 * @example
 * SqlTypeShapeToTs<{ type: "text"; arg: null; nullable: false }, { text: string }> // => string
 * SqlTypeShapeToTs<{ type: "integer"; arg: null; nullable: false }, { integer: number }> // => number
 * SqlTypeShapeToTs<{ type: "array"; arg: { type: "text"; arg: null; nullable: false }; nullable: false }, { text: string }> // => readonly string[]
 * SqlTypeShapeToTs<{ type: "text"; arg: null; nullable: true }, { text: string }> // => string | null
 */
export type SqlTypeShapeToTs<Shape extends SqlTypeShape, ScalarMap extends Record<string, unknown>, Db = never> =
	// TYPE-7, TYPE-8: a nullable shape (column without NOT NULL, or an expression the SEL/EXPR rules make
	// nullable) is typed `T | null`; for an array the nullability is that of the whole array (`readonly X[] | null`).
	Shape["nullable"] extends false
		? SqlTypeShapeToTsNonNull<Shape, ScalarMap, Db>
		: SqlTypeShapeToTsNonNull<Shape, ScalarMap, Db> | null

type SqlTypeShapeToTsNonNull<
	Shape extends SqlTypeShape,
	ScalarMap extends Record<string, unknown>,
	Db,
> = Shape["type"] extends "null" // CORE-5: the literal NULL alone is typed `null`
	? null
	: Shape["type"] extends "array"
		? // PGT-12: nested once per dimension
			Shape["arg"] extends SqlTypeShape
			? readonly SqlTypeShapeToTs<Shape["arg"], ScalarMap, Db>[]
			: readonly unknown[]
		: Shape["type"] extends "enum"
			? // PGT-13: the union of the labels
				JsqlEnumLabelUnion<Db, Shape["arg"]>
			: Lowercase<Shape["type"]> extends infer K extends string
				? K extends keyof ScalarMap
					? ScalarMap[K]
					: unknown
				: unknown

/**
 * Maps a single SQL type string to its corresponding TypeScript type using the scalarTypes map.
 * DEPRECATED: Use SqlTypeShapeToTs instead. This is kept for backward compatibility.
 *
 * @example
 * SqlTypeToTs<"text", { text: string }> // => string
 * SqlTypeToTs<"integer", { integer: number }> // => number
 * SqlTypeToTs<"unknown_type", { text: string }> // => unknown
 */
export type SqlTypeToTs<SqlType extends string, ScalarMap extends Record<string, unknown>> =
	Lowercase<SqlType> extends `${infer Base}[]`
		? Base extends keyof ScalarMap
			? readonly ScalarMap[Base][]
			: readonly unknown[]
		: Lowercase<SqlType> extends infer K extends string
			? K extends keyof ScalarMap
				? ScalarMap[K]
				: unknown
			: unknown

/**
 * Converts a record of SQL types (SqlTypeShape or string) to a record of TypeScript types.
 *
 * This is used to convert the internal SQL type representation to the external TypeScript
 * representation at the query boundary.
 *
 * @example
 * SqlColumnsToTs<
 *   { id: { type: "uuid"; arg: null; nullable: false }; name: { type: "text"; arg: null; nullable: false } },
 *   { uuid: string; text: string }
 * >
 * // => { id: string; name: string }
 */
export type SqlColumnsToTs<
	SqlCols extends Record<string, SqlTypeShape | string>,
	ScalarMap extends Record<string, unknown>,
	Db = never,
> = {
	[K in keyof SqlCols]: SqlCols[K] extends SqlTypeShape
		? SqlTypeShapeToTs<SqlCols[K], ScalarMap, Db>
		: SqlCols[K] extends string
			? SqlTypeToTs<SqlCols[K], ScalarMap>
			: unknown
}

/**
 * Applies SQL-to-TypeScript conversion to a SqlSelectRow result.
 *
 * Takes the SQL column types (SqlTypeShape or strings) returned by SqlSelectRow and converts them
 * to TypeScript types using the scalarTypes map. If the input is an error type,
 * it passes through unchanged.
 *
 * @example
 * ApplySqlToTsConversion<
 *   { id: { type: "uuid"; arg: null; nullable: false }; name: { type: "text"; arg: null; nullable: false } },
 *   { uuid: string; text: string }
 * >
 * // => { id: string; name: string }
 */
export type ApplySqlToTsConversion<
	Config extends DriverConfig,
	SqlColumns,
	/** The chain: enum labels are read from it (PGT-13). */
	Db = never,
> = SqlColumns extends {
	__sql_parser_error__: string
}
	? SqlColumns
	: SqlColumns extends Record<string, SqlTypeShape>
		? [FirstUnmappedSqlType<SqlColumns, Config["scalarTypes"]>] extends [never]
			? SqlColumnsToTs<SqlColumns, Config["scalarTypes"], Db>
			: FormatError<
					Errors["NO_TYPESCRIPT_TYPE_FOR_SQL_TYPE"],
					[FirstUnmappedSqlType<SqlColumns, Config["scalarTypes"]>, Dialects[Config["dialect"]]["castHint"]]
				>
		: SqlColumns

/**
 * CORE-14: the SQL type name of the first output column that has no TypeScript mapping in the driver's type map,
 * or `never` when every column maps. `null` (CORE-5) and arrays of mapped types map without a row of their own.
 */
export type FirstUnmappedSqlType<
	SqlColumns extends Record<string, SqlTypeShape>,
	ScalarMap extends Record<string, unknown>,
> = {
	[K in keyof SqlColumns]: UnmappedTypeName<SqlColumns[K], ScalarMap>
}[keyof SqlColumns]

type UnmappedTypeName<Shape extends SqlTypeShape, ScalarMap extends Record<string, unknown>> = Shape["type"] extends
	| "null"
	| "enum"
	? never
	: Shape["type"] extends "array"
		? Shape["arg"] extends SqlTypeShape
			? UnmappedTypeName<Shape["arg"], ScalarMap>
			: never
		: Lowercase<Shape["type"]> extends keyof ScalarMap
			? never
			: Shape["type"]
