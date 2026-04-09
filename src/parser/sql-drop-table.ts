import type { SqlParseError } from "../sql-parse-error.js"
import type { ReadQualifiedIdentifier } from "./sql-parse-primitives.js"
import type { NormalizeSql } from "./sql-parse-primitives.js"
import type { ToLower } from "./sql-parse-primitives.js"

export type SqlDropTable<S extends string> = [ParseDropTableTarget<S>] extends [never]
	? SqlParseError<"Expected a DROP TABLE statement with a table target">
	: {
			readonly kind: "drop_table"
			readonly target: ParseDropTableTarget<S>
			readonly ifExists: ParseDropIfExists<S>
			readonly source: S
		}

export type SqlDropTableLike = {
	readonly kind: "drop_table"
	readonly target: string
	readonly ifExists: boolean
	readonly source: string
}

type ParseDropTableTarget<S extends string> =
	ToLower<NormalizeSql<S>> extends `drop table if exists ${infer Rest}`
		? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
			? Name
			: never
		: ToLower<NormalizeSql<S>> extends `drop table ${infer Rest}`
			? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
				? Name
				: never
			: never

type ParseDropIfExists<S extends string> =
	ToLower<NormalizeSql<S>> extends `drop table if exists ${string}` ? true : false
