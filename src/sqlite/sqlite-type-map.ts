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
	/** NUMERIC affinity (SQLT-7): `number` (SQLT-6, SQLT-8). */
	numeric: number
	/** BOOLEAN columns and comparison results are integers 0/1 (SQLT-9): `number` (`bigint` in big-integer mode). */
	boolean: Integer
	/** A column with no type, or `ANY`: any storage class (SQLT-10); `null` is added when the column is nullable. */
	any: Integer | number | string | Uint8Array
	/** `count(*)` and similar shared-parser results that are integers. */
	bigint: Integer
}

/** Options of `betterSqlite3Driver` / `nodeSqliteDriver` (SQLT-4). */
export type SqliteDriverOptions = {
	/** Big-integer mode: every INTEGER value is a `bigint` (`safeIntegers` / `readBigInts`). @default false */
	bigint?: boolean
}

/**
 * Config of a SQLite driver: its dialect (DSEL-1) and every SQLite parameter form (`?`, `?NNN`, `:n`, `@n`, `$n`;
 * `indexed-params` is PostgreSQL's `$1`, not SQLite's). `bigint` is a type-level flag mirroring {@link SqliteDriverOptions}.
 */
export type SqliteDriverConfig<Bigint extends boolean = false> = {
	dialect: "sqlite"
	scalarTypes: SqliteTypeMap<Bigint extends true ? bigint : number>
	syntax: "question-params" | "named-params"
}
