/**
 * SQLT-3 / SQLT-4: SQL value → TS type by storage class, as the SQLite drivers return it at runtime.
 * `Integer` is `number` by default and `bigint` in big-integer mode (`{ bigint: true }`).
 */
export type SqliteTypeMap<Integer extends number | bigint = number> = {
	integer: Integer
	real: number
	text: string
	blob: Uint8Array
	null: null
	/**
	 * NUMERIC affinity (SQLT-7): a column of this affinity holds numbers and text (a value that does not look like a
	 * number stays text), and in big-integer mode a stored whole number comes back as a `bigint`: `number | string`,
	 * plus `bigint` in that mode (#169; SQLT-4, SQLT-6, SQLT-8). Writes accept text and numbers.
	 */
	numeric: number | string | (Integer extends bigint ? bigint : never)
	/** BOOLEAN columns and comparison results are integers 0/1 (SQLT-9): `number` (`bigint` in big-integer mode). */
	boolean: Integer
	/** A column with no type, or `ANY`: any storage class (SQLT-10); `null` is added when the column is nullable. */
	any: Integer | number | string | Uint8Array
	/** `typeof(x)` (SQLT-50): the name of a storage class. */
	typeof: "null" | "integer" | "real" | "text" | "blob"
	/** `count(*)` and similar shared-parser results that are integers. */
	bigint: Integer
	/** `key` of `json_each` / `json_tree` (SQLT-70): an array index or an object label. */
	json_key: Integer | string
	/** `value` / `atom` of `json_each` / `json_tree` (SQLT-70, SQLT-Q14): a number or text (arrays and objects as JSON text). */
	json_value: Integer | number | string
	/** A value argument of a JSON function (SQLT-75): only a parameter has this type; it accepts `null` besides (see the parameter map). */
	json_arg: Integer | number | string
	/** `type` of `json_each` / `json_tree` (SQLT-70). */
	json_type: "null" | "true" | "false" | "integer" | "real" | "text" | "array" | "object"
}

/**
 * SQLT-32: what a parameter VALUE may be, per SQL type. Both drivers bind `number`, `bigint`, `string`, `Uint8Array`
 * and `null`; an integer position accepts `number` and `bigint` (in either mode); `boolean`, `Date` and objects are not
 * bindable, so no row accepts them. `null` is added by the nullability of the position.
 */
type SqliteParamTypeMap = Omit<
	SqliteTypeMap,
	"integer" | "boolean" | "bigint" | "any" | "numeric" | "json_key" | "json_value" | "json_arg"
> & {
	integer: number | bigint
	numeric: number | bigint | string
	boolean: number | bigint
	bigint: number | bigint
	any: number | bigint | string | Uint8Array
	json_key: number | bigint | string
	json_value: number | bigint | string
	/** SQLT-75: any SQLite value but a blob; `null` is part of the type, the argument does not make a result nullable. */
	json_arg: number | bigint | string | null
}

/** Options of `betterSqlite3Driver` / `nodeSqliteDriver` (SQLT-4). */
export type SqliteDriverOptions = {
	/** Big-integer mode: every INTEGER value is a `bigint` (`safeIntegers` / `readBigInts`). @default false */
	bigint?: boolean
}

/**
 * Config of a SQLite driver: its dialect (DSEL-1) and every SQLite parameter form (`?`, `?NNN`, `:n`, `@n`, `$n`;
 * `indexed-params` is PostgreSQL's `$1`, not SQLite's). `bigint` is a type-level flag mirroring {@link SqliteDriverOptions};
 * `SingleStatement` marks a driver that runs only the first statement of a text (node:sqlite, #156).
 */
export type SqliteDriverConfig<Bigint extends boolean = false, SingleStatement extends boolean = false> = {
	dialect: "sqlite"
	scalarTypes: SqliteTypeMap<Bigint extends true ? bigint : number>
	paramTypes: SqliteParamTypeMap
	syntax: "question-params" | "named-params"
	singleStatement: SingleStatement extends true ? true : undefined
}
