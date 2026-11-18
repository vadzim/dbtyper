import { createDriver, type SqlDriver, type SqlDriverParams } from "../core/sql-database.ts"
import type { SqliteDriverConfig, SqliteDriverOptions } from "./sqlite-type-map.ts"

/** The part of a `better-sqlite3` / `node:sqlite` statement the adapters use (structural: no import of either package). */
type StatementLike = {
	all(...params: unknown[]): unknown[]
	iterate(...params: unknown[]): Iterable<unknown>
}

type BetterStatement = StatementLike & {
	reader: boolean
	run(...params: unknown[]): unknown
	safeIntegers(on?: boolean): unknown
}

type NodeStatement = StatementLike & {
	run(...params: unknown[]): unknown
	setReadBigInts(on: boolean): unknown
}

/** A `better-sqlite3` `Database`. */
export type BetterSqlite3Like = { prepare(sql: string): unknown }
/** A `node:sqlite` `DatabaseSync`. */
export type NodeSqliteLike = { prepare(sql: string): unknown }

/** SQLT-30: arrays bind `?`/`?NNN` in order, objects bind `:name`/`@name`/`$name` by bare name. */
function bindArgs(params?: SqlDriverParams): unknown[] {
	if (params === undefined) {
		return []
	}
	return Array.isArray(params) ? [...params] : [params]
}

/**
 * better-sqlite3 treats `?NNN` as a named parameter "NNN", so an array does not bind to it positionally;
 * retry once with the array as an object keyed 1, 2, ….
 */
function withNumberedFallback<T>(
	params: SqlDriverParams | undefined,
	args: unknown[],
	call: (args: unknown[]) => T,
): T {
	try {
		return call(args)
	} catch (error) {
		if (!Array.isArray(params) || !(error instanceof RangeError)) {
			throw error
		}
		return call([Object.fromEntries(args.map((value, i) => [String(i + 1), value]))])
	}
}

function adapt<Stmt extends StatementLike, Big extends boolean>(
	prepare: (sql: string) => Stmt,
	reads: (stmt: Stmt) => boolean,
	run: (stmt: Stmt, args: unknown[]) => void,
	retry: <T>(params: SqlDriverParams | undefined, args: unknown[], call: (args: unknown[]) => T) => T = (_p, a, c) =>
		c(a),
): SqlDriver<SqliteDriverConfig<Big>> {
	// SQLT-5: both drivers are synchronous underneath; query returns a promise, stream an async iterable.
	return createDriver<SqliteDriverConfig<Big>>({
		async query(text, params) {
			const stmt = prepare(text)
			const args = bindArgs(params)
			if (!reads(stmt)) {
				retry(params, args, a => run(stmt, a))
				return []
			}
			return retry(params, args, a => stmt.all(...a))
		},
		async stream(text, params): Promise<AsyncIterable<unknown>> {
			const stmt = prepare(text)
			const args = bindArgs(params)
			if (!reads(stmt)) {
				throw new Error("stream() requires a row-returning statement (SELECT or RETURNING clause)")
			}
			return (async function* () {
				yield* retry(params, args, a => stmt.iterate(...a))
			})()
		},
	})
}

/**
 * SQLT-2: adapts a `better-sqlite3` `Database` to dbtyper's {@link SqlDriver}.
 * Rows: INTEGER → number (bigint with `{ bigint: true }`), REAL → number, TEXT → string, BLOB → Buffer (a `Uint8Array`).
 */
export function betterSqlite3Driver(
	db: BetterSqlite3Like,
	options: { bigint: true },
): SqlDriver<SqliteDriverConfig<true>>
export function betterSqlite3Driver(db: BetterSqlite3Like, options?: SqliteDriverOptions): SqlDriver<SqliteDriverConfig>
export function betterSqlite3Driver(
	db: BetterSqlite3Like,
	options: SqliteDriverOptions = {},
): SqlDriver<SqliteDriverConfig<boolean>> {
	const bigint = options.bigint === true
	return adapt<BetterStatement, boolean>(
		sql => {
			const stmt = db.prepare(sql) as BetterStatement
			if (stmt.reader) {
				stmt.safeIntegers(bigint)
			}
			return stmt
		},
		stmt => stmt.reader,
		(stmt, args) => void stmt.run(...args),
		withNumberedFallback,
	)
}

/**
 * SQLT-2: adapts a `node:sqlite` `DatabaseSync` to dbtyper's {@link SqlDriver}.
 * Rows: INTEGER → number (bigint with `{ bigint: true }`), REAL → number, TEXT → string, BLOB → Uint8Array.
 */
export function nodeSqliteDriver(db: NodeSqliteLike, options: { bigint: true }): SqlDriver<SqliteDriverConfig<true>>
export function nodeSqliteDriver(db: NodeSqliteLike, options?: SqliteDriverOptions): SqlDriver<SqliteDriverConfig>
export function nodeSqliteDriver(
	db: NodeSqliteLike,
	options: SqliteDriverOptions = {},
): SqlDriver<SqliteDriverConfig<boolean>> {
	const bigint = options.bigint === true
	return adapt<NodeStatement, boolean>(
		sql => {
			const stmt = db.prepare(sql) as NodeStatement
			stmt.setReadBigInts(bigint)
			return stmt
		},
		// node:sqlite has no `reader` flag; `all()` on a non-returning statement runs it and gives [].
		() => true,
		() => {},
	)
}
