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
	columns?(): unknown[]
	run(...params: unknown[]): unknown
	setReadBigInts(on: boolean): unknown
}

/** A `better-sqlite3` `Database`. */
export type BetterSqlite3Like = { prepare(sql: string): unknown }
/** A `node:sqlite` `DatabaseSync`. */
export type NodeSqliteLike = { prepare(sql: string): unknown }

/** What a SQLite text asks for, read once by {@link scanSqliteParams} (#170). */
type SqliteParamScan = {
	/** `?NNN` is used: better-sqlite3 reads it as a named parameter "NNN", so an array is bound as `{1: …, 2: …}`. */
	numbered: boolean
	/** How many positional values the text takes (`?`, `?NNN`, and the named ones, as SQLite numbers them). */
	count: number
	/** The bare names of `:name`, `@name`, `$name`. */
	names: ReadonlySet<string>
}

const IDENT_CHAR = /[A-Za-z0-9_$]/
const NAME_CHAR = /[A-Za-z0-9_]/

/**
 * One pass over the SQL text for parameters outside string literals, quoted names and comments (the lexer works on
 * types only, so this is a run-time scan; it reads the shared scanner, src/core/sql-text-scanner.ts, which
 * test/runtime/sql-text-scanner.test.ts keeps in step with the lexer's quoting cases).
 */
function scanSqliteParams(sql: string): SqliteParamScan {
	const names = new Set<string>()
	let numbered = false
	let count = 0
	let i = 0
	while (i < sql.length) {
		const skipTo = skipNonCode(sql, i, SQLITE_SCAN_RULES)
		if (skipTo > i) {
			i = skipTo
			continue
		}
		const ch = sql[i] as string
		if (ch === "?") {
			let j = i + 1
			while (j < sql.length && /[0-9]/.test(sql[j] as string)) j++
			if (j > i + 1) {
				numbered = true
				count = Math.max(count, Number(sql.slice(i + 1, j)))
			} else {
				count++
			}
			i = j
		} else if (
			(ch === ":" || ch === "@" || (ch === "$" && !IDENT_CHAR.test(sql[i - 1] ?? " "))) &&
			NAME_CHAR.test(sql[i + 1] ?? " ")
		) {
			let j = i + 1
			while (j < sql.length && NAME_CHAR.test(sql[j] as string)) j++
			const name = sql.slice(i + 1, j)
			if (!names.has(name)) {
				names.add(name)
				count++
			}
			i = j
		} else {
			i++
		}
	}
	return { numbered, count, names }
}

/** The scans of the most recent texts: every call would otherwise read the same text again. */
const scanCache = new Map<string, SqliteParamScan>()
const CACHE_SIZE = 200

function cached<V>(cache: Map<string, V>, key: string, make: () => V): V {
	const hit = cache.get(key)
	if (hit !== undefined) {
		return hit
	}
	const value = make()
	if (cache.size >= CACHE_SIZE) {
		cache.delete(cache.keys().next().value as string)
	}
	cache.set(key, value)
	return value
}

/** True when the SQL text has a numbered parameter `?NNN` outside string literals, quoted names and comments. */
export function usesNumberedParams(sql: string): boolean {
	return cached(scanCache, sql, () => scanSqliteParams(sql)).numbered
}

/**
 * SQLT-30: arrays bind `?`/`?NNN` in order, objects bind `:name`/`@name`/`$name` by bare name. PARAM-14 (#170): a value
 * the text does not read is left out, because both engines throw for a surplus array element (better-sqlite3 also
 * for no parameters at all) and node:sqlite for an unknown name.
 */
function bindArgs(sql: string, params: SqlDriverParams | undefined, numberedByName: boolean): unknown[] {
	if (params === undefined) {
		return []
	}
	const scan = cached(scanCache, sql, () => scanSqliteParams(sql))
	if (Array.isArray(params)) {
		const values = params.slice(0, scan.count)
		return numberedByName && scan.numbered ? numberedArgs(values) : values
	}
	const used = Object.fromEntries(Object.entries(params).filter(([name]) => scan.names.has(name)))
	return Object.keys(used).length === 0 ? [] : [used]
}

function numberedArgs(args: unknown[]): unknown[] {
	return [Object.fromEntries(args.map((value, i) => [String(i + 1), value]))]
}

function adapt<Stmt extends StatementLike, Big extends boolean, Single extends boolean>(
	prepare: (sql: string) => Stmt,
	reads: (stmt: Stmt) => boolean,
	run: (stmt: Stmt, args: unknown[]) => void,
	/** better-sqlite3 reads `?NNN` as a named parameter; node:sqlite binds it by position. */
	bindsNumberedByName: boolean,
): SqlDriver<SqliteDriverConfig<Big, Single>> {
	const args = (text: string, params: SqlDriverParams | undefined) => bindArgs(text, params, bindsNumberedByName)
	// `query` runs a statement to the end before it returns, so one prepared statement per text can be reused; `stream`
	// keeps its statement open while the caller iterates, so it prepares its own.
	const prepared = new Map<string, Stmt>()
	// SQLT-5: both drivers are synchronous underneath; query returns a promise, stream an async iterable.
	return createDriver<SqliteDriverConfig<Big, Single>>({
		defaultSchema: "main",
		async query(text, params) {
			const stmt = cached(prepared, text, () => prepare(text))
			const values = args(text, params)
			if (!reads(stmt)) {
				run(stmt, values)
				return []
			}
			return stmt.all(...values)
		},
		async stream(text, params): Promise<AsyncIterable<unknown>> {
			const stmt = prepare(text)
			const values = args(text, params)
			if (!reads(stmt)) {
				throw new Error(STREAM_REQUIRES_ROWS_MESSAGE)
			}
			return (async function* () {
				yield* stmt.iterate(...values)
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
	return adapt<BetterStatement, boolean, false>(
		sql => {
			const stmt = db.prepare(sql) as BetterStatement
			if (stmt.reader) {
				stmt.safeIntegers(bigint)
			}
			return stmt
		},
		stmt => stmt.reader,
		(stmt, args) => void stmt.run(...args),
		true,
	)
}

/**
 * SQLT-2: adapts a `node:sqlite` `DatabaseSync` to dbtyper's {@link SqlDriver}.
 * Rows: INTEGER → number (bigint with `{ bigint: true }`), REAL → number, TEXT → string, BLOB → Uint8Array.
 * It runs only the first statement of a text, so a second statement is a compile error in `query` / `stream` (#156).
 */
export function nodeSqliteDriver(
	db: NodeSqliteLike,
	options: { bigint: true },
): SqlDriver<SqliteDriverConfig<true, true>>
export function nodeSqliteDriver(
	db: NodeSqliteLike,
	options?: SqliteDriverOptions,
): SqlDriver<SqliteDriverConfig<false, true>>
export function nodeSqliteDriver(
	db: NodeSqliteLike,
	options: SqliteDriverOptions = {},
): SqlDriver<SqliteDriverConfig<boolean, true>> {
	const bigint = options.bigint === true
	return adapt<NodeStatement, boolean, true>(
		sql => {
			const stmt = db.prepare(sql) as NodeStatement
			stmt.setReadBigInts(bigint)
			return stmt
		},
		// node:sqlite has no `reader` flag: a statement without result columns does not return rows (a build without
		// `columns()` is taken for a reader, as `all()` on a non-returning statement runs it and gives []).
		stmt => stmt.columns === undefined || stmt.columns().length > 0,
		(stmt, args) => void stmt.run(...args),
		false,
	)
}
