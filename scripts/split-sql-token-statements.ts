/**
 * Runtime tokenization and statement grouping aligned with `ReadTokenFromString` in
 * `core/sql-tokens.ts` (including nested C-style block comments, matching
 * `SkipMultiComment`) and the `;` / paren / bracket policy of `SkipStatement` in
 * `src/parser/skip-statement.ts` (end at `;` when the bracket stack is empty).
 */
import { serviceWords, type TokenKind } from "../core/sql-tokens.ts"

/** Lex, then group into an array of token-arrays, one per top-level `;` segment. */
export function splitSqlsIntoTokens(source: string): SqlRuntimeToken[][] {
	return splitTokenStreamIntoStatements(lexAllSql(source))
}

export function splitSqls(source: string): string[] {
	return splitSqlsIntoTokens(source).map(stringifySql)
}

export function stringifySql(tokens: SqlRuntimeToken[]): string {
	return tokens.map(stringifyToken).join(" ")
}

function stringifyToken(token: SqlRuntimeToken): string {
	switch (token.kind) {
		case "eot": {
			return ""
		}
		case "key": {
			return token.value
		}
		case "ident": {
			return `"${token.value}"`
		}
		case "string": {
			if (!token.value.includes("$$")) {
				return `$$${token.value}$$`
			}
			for (let i = 1; ; i++) {
				if (!token.value.includes(`$${i}$`)) {
					return `$${i}$${token.value}$${i}$`
				}
			}
		}
		default: {
			throw new Error(`Unknown token kind: ${token.kind}`)
		}
	}
}

export type SqlRuntimeToken = { kind: TokenKind; value: string }

const eotToken: SqlRuntimeToken = { kind: "eot", value: "" }

const WS = new Set(" \n\t\r")
function isWs(c: string): boolean {
	return c.length > 0 && WS.has(c)
}
function isStartChar(c: string): boolean {
	return c.length > 0 && /[0-9a-zA-Z_]/.test(c)
}
function isTokenChar(c: string): boolean {
	return c.length > 0 && /[0-9a-zA-Z_$]/.test(c)
}
function isNumericWord(s: string): boolean {
	return /^\d+$/.test(s)
}

/**
 * When `s[start] === "/"` and `s[start+1] === "*"`, return the index after the
 * block-closing `*` + `/` token, with **nested** opens counted the same way as
 * `SkipMultiComment` in `core/sql-tokens.ts`. Returns `n` if the comment is
 * unterminated.
 */
function skipToBlockCommentEnd(s: string, start: number, n: number = s.length): number {
	if (s[start] !== "/" || s[start + 1] !== "*") {
		return start
	}
	let p = start + 2
	let depth = 1
	while (p < n && depth > 0) {
		if (p + 1 < n && s[p]! === "/" && s[p + 1]! === "*") {
			depth += 1
			p += 2
		} else if (p + 1 < n && s[p]! === "*" && s[p + 1]! === "/") {
			depth -= 1
			p += 2
		} else {
			p += 1
		}
	}
	return depth === 0 ? p : n
}

/**
 * One token from the buffer at `i` (whitespace is skipped at the start). Follows
 * the same high-level order as the type `ReadTokenFromString`.
 */
export function readNextToken(s: string, i: number): { token: SqlRuntimeToken; end: number } {
	let p = i
	const n = s.length
	while (p < n && isWs(s[p]!)) p += 1
	if (p >= n) {
		return { token: eotToken, end: p }
	}
	// `$$…$$` (dollar, empty tag) — `$$${String}$$${Rest}` in the type
	if (s[p] === "$" && s[p + 1] === "$") {
		const endBody = s.indexOf("$$", p + 2)
		if (endBody < 0) {
			return { token: eotToken, end: n }
		}
		const text = s.slice(p + 2, endBody)
		return { token: { kind: "string", value: text }, end: endBody + 2 }
	}
	// `$tag$…$tag$` — `ReadTaggedDollar` in `core/sql-tokens.ts`
	if (s[p] === "$") {
		let t = p + 1
		const tag0 = t
		while (t < n && isTokenChar(s[t]!)) t += 1
		if (t < n && s[t]! === "$") {
			const tag = s.slice(tag0, t)
			const afterOpen = t + 1
			const close = "$" + tag + "$"
			const nextClose = s.indexOf(close, afterOpen)
			if (nextClose >= 0) {
				const text = s.slice(afterOpen, nextClose)
				return { token: { kind: "string", value: text }, end: nextClose + close.length }
			}
		}
	}
	// double-quoted idents → `TokenIdent` in the type
	if (s[p]! === '"') {
		const q0 = p + 1
		const q1 = s.indexOf('"', q0)
		if (q1 < 0) {
			return { token: eotToken, end: n }
		}
		return { token: { kind: "ident", value: s.slice(q0, q1) }, end: q1 + 1 }
	}
	// single-quoted strings → `TokenString`
	if (s[p]! === "'") {
		const q0 = p + 1
		const q1 = s.indexOf("'", q0)
		if (q1 < 0) {
			return { token: eotToken, end: n }
		}
		return { token: { kind: "string", value: s.slice(q0, q1) }, end: q1 + 1 }
	}
	// backtick idents
	if (s[p]! === "`") {
		const q0 = p + 1
		const q1 = s.indexOf("`", q0)
		if (q1 < 0) {
			return { token: eotToken, end: n }
		}
		return { token: { kind: "ident", value: s.slice(q0, q1) }, end: q1 + 1 }
	}
	// line comment
	if (s[p]! === "-" && s[p + 1]! === "-") {
		let t = p + 2
		while (t < n) {
			const c = s[t]!
			if (c === "\n" || c === "\r") {
				return readNextToken(s, t + (c === "\r" && t + 1 < n && s[t + 1] === "\n" ? 2 : 1))
			}
			t += 1
		}
		return readNextToken(s, t)
	}
	// block comment (nested `/*` / `*/` like `SkipMultiComment` in `core/sql-tokens.ts`)
	if (s[p]! === "/" && s[p + 1]! === "*") {
		const after = skipToBlockCommentEnd(s, p, n)
		if (after >= n) {
			return { token: eotToken, end: n }
		}
		return readNextToken(s, after)
	}
	// word: `CheckDoubleQuotes<Lowercase<...>>` → `TokenKey` vs `TokenIdent`
	if (isStartChar(s[p]!)) {
		let t = p + 1
		while (t < n && isTokenChar(s[t]!)) t += 1
		const w = s.slice(p, t).toLowerCase()
		if (serviceWords.has(w) || isNumericWord(w)) {
			return { token: { kind: "key", value: w }, end: t }
		}
		return { token: { kind: "ident", value: w }, end: t }
	}
	// any other single char → one `key` (as in the type: `TokenKey<Head>, Rest` when
	// the head is not a start char)
	return { token: { kind: "key", value: s[p]! }, end: p + 1 }
}

/** All tokens in order, with a final `{ kind: "eot" }` (matches the end of the type list). */
export function lexAllSql(s: string): SqlRuntimeToken[] {
	const out: SqlRuntimeToken[] = []
	let i = 0
	for (;;) {
		const { token, end } = readNextToken(s, i)
		out.push(token)
		if (token.kind === "eot" || end >= s.length) {
			break
		}
		i = end
	}
	return out
}

/**
 * New statement on `;` when the `( )` / `[ ]` stack (like `SkipStatement`’s
 * `ClosingBrackets` stack) is empty. The `;` token is the last element of
 * a completed statement (as when skipping to a statement terminator).
 */
export function splitTokenStreamIntoStatements(tokens: readonly SqlRuntimeToken[]): SqlRuntimeToken[][] {
	const statements: SqlRuntimeToken[][] = []
	const stack: (")" | "]")[] = []
	let cur: SqlRuntimeToken[] = []
	for (const t of tokens) {
		if (t.kind === "eot") {
			if (cur.length > 0) {
				cur.push(t)
				statements.push(cur)
			}
			break
		}
		if (t.kind === "key" && t.value === "(") {
			stack.push(")")
		} else if (t.kind === "key" && t.value === "[") {
			stack.push("]")
		} else if (t.kind === "key" && t.value === ")") {
			if (stack.length > 0 && stack[stack.length - 1] === ")") {
				stack.pop()
			}
		} else if (t.kind === "key" && t.value === "]") {
			if (stack.length > 0 && stack[stack.length - 1] === "]") {
				stack.pop()
			}
		}
		if (t.kind === "key" && t.value === ";" && stack.length === 0) {
			statements.push(cur)
			cur = []
		} else {
			cur.push(t)
		}
	}
	if (cur.length > 0) {
		statements.push(cur)
	}
	return statements
}
