import type { SqlParseError } from "./sql-parse-error.js"
import type {
	IsTokenRestEmpty,
	ReadExpectedToken,
	ReadOptionalIfExists,
	ReadQualifiedIdentifier,
	SqlQualifiedIdentifier,
	Trim,
} from "./sql-parse-primitives.js"
import type { ReadToken } from "./sql-tokens.js"

export type SqlDropTableLike = {
	readonly kind: "drop_table"
	readonly target: SqlQualifiedIdentifier
	readonly ifExists: boolean
}

export type SqlDropTable<S extends string> =
	ReadToken<S> extends ["drop", infer AfterDrop extends string]
		? ReadToken<AfterDrop> extends ["table", string]
			? FinalizeDropTable<ParseDropTableTuple<S>>
			: never
		: never

type FinalizeDropTable<T> = T extends [infer E extends SqlParseError<string>, string]
	? E
	: T extends [infer Result, infer Rest extends string]
		? IsTokenRestEmpty<Rest> extends true
			? Result
			: SqlParseError<"Unable to parse DROP TABLE statement">
		: never

type ParseDropTableTuple<S extends string> =
	ReadExpectedToken<S, "drop", "Unable to parse DROP TABLE statement"> extends [
		infer DropResult,
		infer RestDrop extends string,
	]
		? DropResult extends SqlParseError<string>
			? [DropResult, RestDrop]
			: ReadExpectedToken<RestDrop, "table", "Unable to parse DROP TABLE statement"> extends [
					infer TableResult,
					infer RestTable extends string,
				]
				? TableResult extends SqlParseError<string>
					? [TableResult, RestTable]
					: ReadOptionalIfExists<RestTable> extends [true, infer RestFlag extends string]
						? ParseDropTableWithFlag<true, RestFlag>
						: ReadOptionalIfExists<RestTable> extends [false, infer RestFlag extends string]
							? ParseDropTableWithFlag<false, RestFlag>
							: ReadOptionalIfExists<RestTable> extends [
									  infer FlagError extends SqlParseError<string>,
									  infer RestFlag extends string,
								  ]
								? [FlagError, RestFlag]
								: [SqlParseError<"Unable to parse DROP TABLE statement">, S]
				: [SqlParseError<"Unable to parse DROP TABLE statement">, S]
		: [SqlParseError<"Unable to parse DROP TABLE statement">, S]

type ParseDropTableWithFlag<IfExists extends boolean, S extends string> =
	ReadQualifiedIdentifier<S> extends [infer Name extends SqlQualifiedIdentifier, infer RestName extends string]
		? IsTokenRestEmpty<RestName> extends true
			? [
					{
						readonly kind: "drop_table"
						readonly ifExists: IfExists
						readonly target: Name
					},
					"",
				]
			: [SqlParseError<"Unable to parse DROP TABLE statement">, Trim<RestName>]
		: [SqlParseError<"Unable to parse DROP TABLE statement">, S]
