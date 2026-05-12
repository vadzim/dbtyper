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

/**
 * Maps a SqlTypeShape to its corresponding TypeScript type using the scalarTypes map.
 *
 * @example
 * SqlTypeShapeToTs<{ type: "text"; arg: null; nullable: false }, { text: string }> // => string
 * SqlTypeShapeToTs<{ type: "integer"; arg: null; nullable: false }, { integer: number }> // => number
 * SqlTypeShapeToTs<{ type: "array"; arg: { type: "text"; arg: null; nullable: false }; nullable: false }, { text: string }> // => readonly string[]
 */
export type SqlTypeShapeToTs<
	Shape extends SqlTypeShape,
	ScalarMap extends Record<string, unknown>,
> = Shape["type"] extends "array"
	? Shape["arg"] extends SqlTypeShape
		? Lowercase<Shape["arg"]["type"]> extends infer K extends string
			? K extends keyof ScalarMap
				? readonly ScalarMap[K][]
				: readonly unknown[]
			: readonly unknown[]
		: readonly unknown[]
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
> = {
	[K in keyof SqlCols]: SqlCols[K] extends SqlTypeShape
		? SqlTypeShapeToTs<SqlCols[K], ScalarMap>
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
export type ApplySqlToTsConversion<Config extends DriverConfig, SqlColumns> = SqlColumns extends {
	__sql_parser_error__: string
}
	? SqlColumns
	: SqlColumns extends Record<string, SqlTypeShape | string>
		? SqlColumnsToTs<SqlColumns, Config["scalarTypes"]>
		: SqlColumns
