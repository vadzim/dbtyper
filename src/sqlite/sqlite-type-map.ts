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
