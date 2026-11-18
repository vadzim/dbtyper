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
 * Plain config of a SQLite driver. Declares the SQLite dialect (DSEL-1, DSEL-8).
 * `bigint` is a type-level flag mirroring {@link SqliteDriverOptions}.
 */
export type SqliteDriverConfig<Bigint extends boolean = false> = {
	scalarTypes: SqliteTypeMap<Bigint extends true ? bigint : number>
	syntax: "question-params"
	dialect: "sqlite"
}
