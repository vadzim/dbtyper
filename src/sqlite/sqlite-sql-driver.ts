import { createDriver, type SqlDriver, type SqlDriverParams } from "../core/sql-database.ts"
import { STREAM_REQUIRES_ROWS_MESSAGE } from "../core/stream-requires-rows.ts"
import { SQLITE_SCAN_RULES, skipNonCode } from "../core/sql-text-scanner.ts"
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
 * True when the SQL text has a numbered parameter `?NNN` outside string literals, quoted names and comments.
 * better-sqlite3 treats `?NNN` as a named parameter "NNN", so an array must be bound to it as {1: …, 2: …}.
 * This is a run-time scan because the lexer works on types only; it reads the shared scanner
 * (src/core/sql-text-scanner.ts), which test/runtime/sql-text-scanner.test.ts keeps in step with the lexer's cases.
 */
export function usesNumberedParams(sql: string): boolean {
	let i = 0
	while (i < sql.length) {
		const skipTo = skipNonCode(sql, i, SQLITE_SCAN_RULES)
		if (skipTo > i) {
			i = skipTo
		} else if (sql[i] === "?" && /[0-9]/.test(sql[i + 1] ?? "")) {
			return true
		} else {
			i++
		}
	}
	return false
}

function numberedArgs(args: unknown[]): unknown[] {
	return [Object.fromEntries(args.map((value, i) => [String(i + 1), value]))]
}

function adapt<Stmt extends StatementLike, Big extends boolean>(
	prepare: (sql: string) => Stmt,
	reads: (stmt: Stmt) => boolean,
	run: (stmt: Stmt, args: unknown[]) => void,
	bindNumbered: (sql: string, params: SqlDriverParams | undefined, args: unknown[]) => unknown[] = (_s, _p, a) => a,
): SqlDriver<SqliteDriverConfig<Big>> {
	// SQLT-5: both drivers are synchronous underneath; query returns a promise, stream an async iterable.
	return createDriver<SqliteDriverConfig<Big>>({
		async query(text, params) {
			const stmt = prepare(text)
			const args = bindNumbered(text, params, bindArgs(params))
			if (!reads(stmt)) {
				run(stmt, args)
				return []
			}
			return stmt.all(...args)
		},
		async stream(text, params): Promise<AsyncIterable<unknown>> {
			const stmt = prepare(text)
			const args = bindNumbered(text, params, bindArgs(params))
			if (!reads(stmt)) {
				throw new Error(STREAM_REQUIRES_ROWS_MESSAGE)
			}
			return (async function* () {
				yield* stmt.iterate(...args)
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
		(sql, params, args) => (Array.isArray(params) && usesNumberedParams(sql) ? numberedArgs(args) : args),
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
