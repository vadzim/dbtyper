import type { SqlParseError } from "../sql-parse-error.js"
import type {
	NormalizeSql,
	ReadQualifiedIdentifier,
	StripLeadingIfExists,
	ToLower,
	Trim,
} from "./sql-parse-primitives.js"

export type SqlAlterTable<S extends string> =
	ToLower<NormalizeSql<S>> extends `alter table ${infer Body extends string}`
		? ParseAlterTableParts<Body> extends [
				infer IfExists extends boolean,
				infer Target extends string,
				infer Action extends string,
			]
			? Action extends ""
				? SqlParseError<"Expected an ALTER TABLE action">
				: {
						readonly kind: "alter_table"
						readonly ifExists: IfExists
						readonly target: Target
						readonly action: Action
						readonly source: S
					}
			: SqlParseError<"Expected an ALTER TABLE statement with a table target">
		: never

export type SqlAlterTableLike = {
	readonly kind: "alter_table"
	readonly ifExists: boolean
	readonly target: string
	readonly action: string
	readonly source: string
}

type ParseAlterTableParts<Body extends string> =
	StripLeadingIfExists<Body> extends [infer IfExists extends boolean, infer RestAfterFlag extends string]
		? ReadQualifiedIdentifier<RestAfterFlag> extends [infer Name extends string, infer Tail extends string]
			? [IfExists, Name, Trim<Tail>]
			: SqlParseError<"Unable to parse ALTER TABLE statement">
		: never
