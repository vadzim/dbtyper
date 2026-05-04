/**
 * Infer SQL type from TypeScript runtime value type.
 * Maps TypeScript types to their corresponding SQL type strings.
 */
export type TsTypeToSqlType<T> = T extends number
	? "numeric"
	: T extends string
		? "text"
		: T extends boolean
			? "boolean"
			: T extends Date
				? "timestamp with time zone"
				: T extends null
					? "text" // null can be any type, default to text
					: T extends undefined
						? "text"
						: "text" // fallback to text for unknown types

/**
 * Infer ExpressionParamsShape from a runtime params object.
 * Converts { userId: 5, name: "Alice" } to { userId: { ts: number; sql: "numeric" }, name: { ts: string; sql: "text" } }
 */
export type InferParamsFromValues<T extends Record<string, unknown>> = {
	[K in keyof T]: { ts: T[K]; sql: TsTypeToSqlType<T[K]> }
}
