/**
 * The one run-time scanner for the text that hides parameter markers: strings, quoted names, comments and
 * dollar-quoted bodies. The type-level lexer (src/lexer/sql-lexer.ts) cannot run at run time, so this repeats its
 * quoting rules once; the PostgreSQL binders and the SQLite driver all read it. A new quoting rule in the lexer needs
 * a row here and a case in test/runtime/sql-text-scanner.test.ts, which runs both dialects on the lexer's cases.
 */

/** Which kinds of non-code text a dialect has (one row per dialect, like the lexer facts in src/core/dialect.ts). */
type SqlScanRules = {
	/** Characters that open a quoted name closed by the same character, doubled to escape (`"x"`, SQLite also `` `x` ``). */
	readonly quotedNames: string
	/** `[x]` quoted names (SQLite). */
	readonly bracketNames: boolean
	/** Block comments nest (PostgreSQL) or end at the first close (SQLite). */
	readonly nestedBlockComments: boolean
	/** `$tag$ … $tag$` bodies (PostgreSQL). */
	readonly dollarBodies: boolean
}

export const POSTGRES_SCAN_RULES: SqlScanRules = {
	quotedNames: '"',
	bracketNames: false,
	nestedBlockComments: true,
	dollarBodies: true,
}

export const SQLITE_SCAN_RULES: SqlScanRules = {
	quotedNames: '"`',
	bracketNames: true,
	nestedBlockComments: false,
	dollarBodies: false,
}

/** A dollar tag has no length limit: `$` + optional identifier + `$`. */
const DOLLAR_TAG = /\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/y

/** The end of a `close`-terminated run opened at `i`, where a doubled `close` is an escape; the end of text when unterminated. */
function endOfQuoted(sql: string, i: number, close: string, doubles: boolean): number {
	let j = i + 1
	while (j < sql.length) {
		if (sql[j] === close) {
			if (doubles && sql[j + 1] === close) j += 2
			else return j + 1
		} else j++
	}
	return sql.length
}

function endOfBlockComment(sql: string, i: number, nested: boolean): number {
	let depth = 1
	let j = i + 2
	while (j < sql.length) {
		if (nested && sql[j] === "/" && sql[j + 1] === "*") {
			depth++
			j += 2
		} else if (sql[j] === "*" && sql[j + 1] === "/") {
			depth--
			j += 2
			if (depth === 0) return j
		} else j++
	}
	return sql.length
}

/**
 * End index of a string, quoted name, comment or dollar-quoted body that starts at `i`, or `i` when no such text
 * starts there (so the character at `i` is code).
 */
export function skipNonCode(sql: string, i: number, rules: SqlScanRules): number {
	const ch = sql[i] as string
	if (ch === "'") return endOfQuoted(sql, i, "'", true)
	if (rules.quotedNames.includes(ch)) return endOfQuoted(sql, i, ch, true)
	if (ch === "[" && rules.bracketNames) return endOfQuoted(sql, i, "]", false)
	if (ch === "-" && sql[i + 1] === "-") {
		const nl = sql.indexOf("\n", i)
		return nl < 0 ? sql.length : nl
	}
	if (ch === "/" && sql[i + 1] === "*") return endOfBlockComment(sql, i, rules.nestedBlockComments)
	if (ch === "$" && rules.dollarBodies) {
		DOLLAR_TAG.lastIndex = i
		const m = DOLLAR_TAG.exec(sql)
		if (m !== null) {
			const end = sql.indexOf(m[0], i + m[0].length)
			return end < 0 ? sql.length : end + m[0].length
		}
	}
	return i
}
