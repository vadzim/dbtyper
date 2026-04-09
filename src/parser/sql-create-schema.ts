import type { SqlParseError } from "./sql-parse-error.js"
import type {
	NormalizeSql,
	ReadIdentifier,
	StripIdentifierQuotes,
	StripLeadingIfNotExists,
	ToLower,
	Trim,
} from "./sql-parse-primitives.js"

export type SqlCreateSchemaLike = {
	readonly kind: "create_schema"
	readonly name: string
	readonly ifNotExists: boolean
}

export type SqlCreateSchema<S extends string> =
	ToLower<NormalizeSql<S>> extends `create schema ${infer Body extends string}`
		? StripLeadingIfNotExists<Body> extends [infer IfNotExists extends boolean, infer RestAfterFlag extends string]
			? ReadIdentifier<Trim<RestAfterFlag>> extends [infer RawName extends string, infer Tail extends string]
				? Trim<Tail> extends ""
					? StripIdentifierQuotes<RawName> extends infer Name extends string
						? Name extends ""
							? SqlParseError<"Unable to parse CREATE SCHEMA statement">
							: {
									readonly kind: "create_schema"
									readonly name: Name
									readonly ifNotExists: IfNotExists
								}
						: SqlParseError<"Unable to parse CREATE SCHEMA statement">
					: SqlParseError<"Unable to parse CREATE SCHEMA statement">
				: SqlParseError<"Unable to parse CREATE SCHEMA statement">
			: SqlParseError<"Unable to parse CREATE SCHEMA statement">
		: never
