import type {
	ConsumeStatementEnd,
	ReadExpectedToken,
	ReadOptionalIfExists,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-parse-primitives.js"
import type { TokensList, PeekToken, SkipToken, SqlParseError } from "./sql-tokens.js"

export type SqlDropTableLike = {
	readonly kind: "drop_table"
	readonly target: SqlQualifiedIdentifier
	readonly ifExists: boolean
}

export type SqlDropTable<B extends TokensList> =
	PeekToken<B> extends "drop"
		? PeekToken<SkipToken<B>> extends "table"
			? FinalizeDropTableTuple<ParseDropTableTuple<B>>
			: never
		: never

type FinalizeDropTableTuple<T> = T extends [infer E extends SqlParseError<string>, infer R extends TokensList]
	? [E, R]
	: T extends [infer Result, infer Rest extends TokensList]
		? [Result, Rest]
		: never

type ParseDropTableTuple<B extends TokensList> =
	ReadExpectedToken<B, "drop", "Unable to parse DROP TABLE statement"> extends [
		infer DropResult,
		infer RestDrop extends TokensList,
	]
		? DropResult extends SqlParseError<string>
			? [DropResult, RestDrop]
			: ReadExpectedToken<RestDrop, "table", "Unable to parse DROP TABLE statement"> extends [
						infer TableResult,
						infer RestTable extends TokensList,
				  ]
				? TableResult extends SqlParseError<string>
					? [TableResult, RestTable]
					: ReadOptionalIfExists<RestTable> extends [true, infer RestFlag extends TokensList]
						? ParseDropTableWithFlag<true, RestFlag>
						: ReadOptionalIfExists<RestTable> extends [false, infer RestFlag extends TokensList]
							? ParseDropTableWithFlag<false, RestFlag>
							: ReadOptionalIfExists<RestTable> extends [
										infer FlagError extends SqlParseError<string>,
										infer RestFlag extends TokensList,
								  ]
								? [FlagError, RestFlag]
								: [SqlParseError<"Unable to parse DROP TABLE statement">, B]
				: [SqlParseError<"Unable to parse DROP TABLE statement">, B]
		: [SqlParseError<"Unable to parse DROP TABLE statement">, B]

type ParseDropTableWithFlag<IfExists extends boolean, B extends TokensList> =
	ReadQualifiedIdentifierFromBuffer<B> extends [
		infer Name extends SqlQualifiedIdentifier,
		infer RestName extends TokensList,
	]
		? ConsumeStatementEnd<RestName> extends [true, infer Tail extends TokensList]
			? [
					{
						readonly kind: "drop_table"
						readonly ifExists: IfExists
						readonly target: Name
					},
					Tail,
				]
			: [SqlParseError<"Unable to parse DROP TABLE statement">, RestName]
		: [SqlParseError<"Unable to parse DROP TABLE statement">, B]
