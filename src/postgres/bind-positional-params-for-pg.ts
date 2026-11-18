/**
 * Maps `?` tokens to positional placeholders `$1`, `$2`, … for drivers such as `postgres.js`.
 * Only real `?` tokens count: `?` inside '…' strings, "…" identifiers, $tag$…$tag$ bodies, line and block comments is kept.
 * `found` tells whether the text had any real `?` token.
 */
export function bindPositionalParamsForPg(
	sql: string,
	params: readonly unknown[],
): {
	text: string
	values: unknown[]
	found: boolean
} {
	const values: unknown[] = []
	let out = ""
	let i = 0
	let inString = false
	let found = false
	let paramIndex = 0

	while (i < sql.length) {
		const ch = sql[i]

		if (inString) {
			out += ch
			if (ch === "'") {
				if (sql[i + 1] === "'") {
					out += "'"
					i += 2
					continue
				}
				inString = false
			}
			i++
			continue
		}

		const skipTo = skipNonCode(sql, i)
		if (skipTo > i) {
			out += sql.slice(i, skipTo)
			i = skipTo
			continue
		}

		if (ch === "'") {
			inString = true
			out += ch
			i++
			continue
		}

		if (ch === "?") {
			if (paramIndex >= params.length) {
				throw new Error(`Not enough parameters: expected at least ${paramIndex + 1}, got ${params.length}`)
			}
			found = true
			values.push(params[paramIndex])
			out += `$${paramIndex + 1}`
			paramIndex++
			i++
			continue
		}

		out += ch
		i++
	}

	return { text: out, values, found }
}

/** End index of a comment, quoted identifier or dollar-quoted body starting at `i`, or `i` when none starts there. */
function skipNonCode(sql: string, i: number): number {
	const ch = sql[i]
	if (ch === "-" && sql[i + 1] === "-") {
		const nl = sql.indexOf("\n", i)
		return nl < 0 ? sql.length : nl
	}
	if (ch === "/" && sql[i + 1] === "*") {
		let depth = 0
		let j = i
		while (j < sql.length) {
			if (sql[j] === "/" && sql[j + 1] === "*") {
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
	if (ch === '"') {
		let j = i + 1
		while (j < sql.length) {
			if (sql[j] === '"') {
				if (sql[j + 1] === '"') j += 2
				else return j + 1
			} else j++
		}
		return sql.length
	}
	if (ch === "$") {
		const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 64))
		if (m !== null) {
			const end = sql.indexOf(m[0], i + m[0].length)
			return end < 0 ? sql.length : end + m[0].length
		}
	}
	return i
}
