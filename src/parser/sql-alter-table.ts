import type { SqlParseError } from "../sql-parse-error.js"
import type { ReadQualifiedIdentifier } from "./sql-parse-primitives.js"
import type { NormalizeSql } from "./sql-parse-primitives.js"
import type { ToLower, Trim } from "./sql-parse-primitives.js"

export type SqlAlterTable<S extends string> = [ParseAlterTableTarget<S>] extends [never]
	? SqlParseError<"Expected an ALTER TABLE statement with a table target">
	: ParseAlterAction<S> extends infer Action extends string
		? Action extends ""
			? SqlParseError<"Expected an ALTER TABLE action">
			: {
					readonly kind: "alter_table"
					readonly target: ParseAlterTableTarget<S>
					readonly action: Action
					readonly source: S
				}
		: SqlParseError<"Unable to parse ALTER TABLE statement">

export type SqlAlterTableLike = {
	readonly kind: "alter_table"
	readonly target: string
	readonly action: string
	readonly source: string
}

type ParseAlterTableTarget<S extends string> =
	ToLower<NormalizeSql<S>> extends `alter table if exists ${infer Rest}`
		? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
			? Name
			: never
		: ToLower<NormalizeSql<S>> extends `alter table ${infer Rest}`
			? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
				? Name
				: never
			: never

type ParseAlterAction<S extends string> =
	ToLower<NormalizeSql<S>> extends `alter table if exists ${infer Rest}`
		? ReadQualifiedIdentifier<Rest> extends [string, infer Tail extends string]
			? Trim<Tail>
			: never
		: ToLower<NormalizeSql<S>> extends `alter table ${infer Rest}`
			? ReadQualifiedIdentifier<Rest> extends [string, infer Tail extends string]
				? Trim<Tail>
				: never
			: never
