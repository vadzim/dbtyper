import { POSTGRES_SCAN_RULES, skipNonCode } from "../core/sql-text-scanner.ts"

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
	let found = false
	let paramIndex = 0

	while (i < sql.length) {
		const skipTo = skipNonCode(sql, i, POSTGRES_SCAN_RULES)
		if (skipTo > i) {
			out += sql.slice(i, skipTo)
			i = skipTo
			continue
		}

		if (sql[i] === "?") {
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

		out += sql[i]
		i++
	}

	return { text: out, values, found }
}
