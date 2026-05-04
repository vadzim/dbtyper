/**
 * SQL to TypeScript type conversion utilities.
 *
 * This module contains all logic for converting SQL type strings to TypeScript types.
 * It should ONLY be imported by sql-database.ts.
 *
 * DO NOT import this module anywhere else - not in parsers, not in sql-query.ts, nowhere except sql-database.ts.
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

/**
 * Applies SQL-to-TypeScript conversion to a SqlSelectRow result.
 *
 * Takes the SQL column types (strings) returned by SqlSelectRow and converts them
 * to TypeScript types using the scalarTypes map. If the input is a SqlParserError,
 * it passes through unchanged.
 *
 * @example
 * ApplySqlToTsConversion<
 *   { id: "uuid"; name: "text" },
 *   { uuid: string; text: string }
 * >
 * // => { id: string; name: string }
 */
export type ApplySqlToTsConversion<SqlColumns, ScalarMap extends Record<string, unknown>> = SqlColumns extends {
	__sql_parser_error__: string
}
	? SqlColumns
	: SqlColumns extends Record<string, string>
		? SqlColumnsToTs<SqlColumns, ScalarMap>
		: SqlColumns
