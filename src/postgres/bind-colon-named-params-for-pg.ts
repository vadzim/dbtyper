import { POSTGRES_SCAN_RULES, skipNonCode } from "../core/sql-text-scanner.ts"

/**
 * Maps `:param` tokens to positional placeholders `$1`, `$2`, … for drivers such as `postgres.js`.
 * Lexer-aligned through the shared scanner: `:x` is left alone inside '…' strings, "…" identifiers, $tag$…$tag$ bodies
 * and comments, and after a `::` cast.
 */
export function bindColonNamedParamsForPg(
	sql: string,
	params: Record<string, unknown>,
): {
	text: string
	values: unknown[]
} {
	const values: unknown[] = []
	const nameToIndex = new Map<string, number>()
	let out = ""
	let i = 0
	while (i < sql.length) {
		const skipTo = skipNonCode(sql, i, POSTGRES_SCAN_RULES)
		if (skipTo > i) {
			out += sql.slice(i, skipTo)
			i = skipTo
			continue
		}
		const ch = sql[i]
		if (ch === ":" && sql[i + 1] === ":") {
			out += "::"
			i += 2
			continue
		}
		if (ch === ":" && i + 1 < sql.length && /[A-Za-z_]/.test(sql[i + 1] as string)) {
			let j = i + 1
			while (j < sql.length && /[A-Za-z0-9_]/.test(sql[j] as string)) j++
			const name = sql.slice(i + 1, j)
			if (!nameToIndex.has(name)) {
				if (!(name in params)) {
					throw new Error(`Missing SQL parameter :${name}`)
				}
				nameToIndex.set(name, values.length + 1)
				values.push(params[name])
			}
			out += `$${nameToIndex.get(name)!}`
			i = j
			continue
		}
		out += ch
		i++
	}
	return { text: out, values }
}
