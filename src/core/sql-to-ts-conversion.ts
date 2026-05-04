/**
 * SQL to TypeScript type conversion utilities.
 *
 * This module contains all logic for converting SQL type strings to TypeScript types.
 * It should ONLY be imported by sql-query.ts (the query boundary layer).
 *
 * DO NOT import this module in parser code - parsers should work exclusively with SQL type strings.
 */

/**
 * Maps a single SQL type string to its corresponding TypeScript type using the scalarTypes map.
 *
 * @example
 * SqlTypeToTs<"text", { text: string }> // => string
 * SqlTypeToTs<"integer", { integer: number }> // => number
 * SqlTypeToTs<"unknown_type", { text: string }> // => unknown
 */
export type SqlTypeToTs<SqlType extends string, ScalarMap extends Record<string, unknown>> =
	Lowercase<SqlType> extends infer K extends string ? (K extends keyof ScalarMap ? ScalarMap[K] : unknown) : unknown

/**
 * Converts a record of SQL type strings to a record of TypeScript types.
 *
 * This is used to convert the internal SQL type representation (columns as SQL strings)
 * to the external TypeScript representation (columns as TS types) at the query boundary.
 *
 * @example
 * SqlColumnsToTs<
 *   { id: "uuid"; name: "text"; count: "integer" },
 *   { uuid: string; text: string; integer: number }
 * >
 * // => { id: string; name: string; count: number }
 */
export type SqlColumnsToTs<SqlCols extends Record<string, string>, ScalarMap extends Record<string, unknown>> = {
	[K in keyof SqlCols]: SqlTypeToTs<SqlCols[K], ScalarMap>
}
