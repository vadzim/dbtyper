import type { SqlParseError } from "../sql-parse-error.js"
import type { NormalizeSql } from "./sql-parse-primitives.js"
import type { ReadQualifiedIdentifier, StripLeadingIfExists, ToLower } from "./sql-parse-primitives.js"

export type SqlDropTableLike = {
	readonly kind: "drop_table"
	readonly target: string
	readonly ifExists: boolean
	readonly source: string
}

export type SqlDropTable<S extends string> =
	ToLower<NormalizeSql<S>> extends `drop table ${infer Rest}`
		? (Rest extends `if exists ${infer Rest2}` ? [true, Rest2] : [false, Rest]) extends [
				infer IfExists extends boolean,
				infer Rest3 extends string,
			]
			? ReadQualifiedIdentifier<Rest3> extends infer QI
				? [QI] extends [[infer Name extends string, infer Tail extends string]]
					? {
							readonly kind: "drop_table"
							readonly name: Name
							readonly ifExists: IfExists
							readonly target: Tail
							readonly source: S
						}
					: SqlParseError<"drop table name required">
				: SqlParseError<"Unable to parse DROP TABLE statement">
			: SqlParseError<"Unable to parse DROP TABLE statement">
		: never
