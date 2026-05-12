/**
 * Maps `?` tokens to positional placeholders `$1`, `$2`, … for drivers such as `postgres.js`.
 * Skips `?` inside single-quoted string literals.
 */
export function bindPositionalParamsForPg(
	sql: string,
	params: readonly unknown[],
): {
	text: string
	values: unknown[]
} {
	const values: unknown[] = []
	let out = ""
	let i = 0
	let inString = false
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
			values.push(params[paramIndex])
			out += `$${paramIndex + 1}`
			paramIndex++
			i++
			continue
		}

		out += ch
		i++
	}

	return { text: out, values }
}
