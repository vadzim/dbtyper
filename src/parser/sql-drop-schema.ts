import type { SqlParseError } from "./sql-parse-error.js"
import type {
	NormalizeSql,
	ReadIdentifier,
	StripIdentifierQuotes,
	StripLeadingIfExists,
	ToLower,
	Trim,
} from "./sql-parse-primitives.js"

export type SqlDropSchemaLike = {
	readonly kind: "drop_schema"
	readonly name: string
	readonly ifExists: boolean
}

export type SqlDropSchema<S extends string> =
	ToLower<NormalizeSql<S>> extends `drop schema ${infer Body extends string}`
		? StripLeadingIfExists<Body> extends [infer IfExists extends boolean, infer RestAfterFlag extends string]
			? ReadIdentifier<Trim<RestAfterFlag>> extends [infer RawName extends string, infer Tail extends string]
				? Trim<Tail> extends ""
					? StripIdentifierQuotes<RawName> extends infer Name extends string
						? Name extends ""
							? SqlParseError<"Unable to parse DROP SCHEMA statement">
							: {
									readonly kind: "drop_schema"
									readonly name: Name
									readonly ifExists: IfExists
								}
						: SqlParseError<"Unable to parse DROP SCHEMA statement">
					: SqlParseError<"Unable to parse DROP SCHEMA statement">
				: SqlParseError<"Unable to parse DROP SCHEMA statement">
			: SqlParseError<"Unable to parse DROP SCHEMA statement">
		: never
