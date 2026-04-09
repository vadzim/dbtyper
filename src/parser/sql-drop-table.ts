import type { SqlParseError } from "./sql-parse-error.js"
import type { NormalizeSql } from "./sql-parse-primitives.js"
import type { ReadQualifiedIdentifier, StripLeadingIfExists, ToLower } from "./sql-parse-primitives.js"

export type SqlDropTableLike = {
	readonly kind: "drop_table"
	readonly target: string
	readonly ifExists: boolean
	readonly source: string
}

export type SqlDropTable<S extends string> =
	ToLower<NormalizeSql<S>> extends `drop table ${infer Body}`
		? StripLeadingIfExists<Body> extends [infer IfExists extends boolean, infer Rest3 extends string]
			? ReadQualifiedIdentifier<Rest3> extends [infer Name extends string, ""]
				? {
						readonly kind: "drop_table"
						readonly ifExists: IfExists
						readonly target: Name
						readonly source: S
					}
				: SqlParseError<"Unable to parse DROP TABLE statement">
			: SqlParseError<"Unable to parse DROP TABLE statement">
		: never
