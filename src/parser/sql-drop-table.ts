import type {
	ConsumeStatementEnd,
	ReadExpectedToken,
	ReadOptionalIfExists,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-parse-primitives.js"
import type { BufferLike, ReadToken, SqlParseError } from "./sql-tokens.js"

export type SqlDropTableLike = {
	readonly kind: "drop_table"
	readonly target: SqlQualifiedIdentifier
	readonly ifExists: boolean
}

export type SqlDropTable<B extends BufferLike> =
	ReadToken<B> extends ["drop", infer AfterDrop extends BufferLike]
		? ReadToken<AfterDrop> extends ["table", BufferLike]
			? FinalizeDropTableTuple<ParseDropTableTuple<B>>
			: never
		: never

type FinalizeDropTableTuple<T> = T extends [infer E extends SqlParseError<string>, infer R extends BufferLike]
	? [E, R]
	: T extends [infer Result, infer Rest extends BufferLike]
		? ConsumeStatementEnd<Rest> extends [true, infer Tail extends BufferLike]
			? ReadToken<Tail> extends ["", BufferLike]
				? [Result, Tail]
				: [SqlParseError<"Unable to parse DROP TABLE statement">, Rest]
			: [SqlParseError<"Unable to parse DROP TABLE statement">, Rest]
		: never

type ParseDropTableTuple<B extends BufferLike> =
	ReadExpectedToken<B, "drop", "Unable to parse DROP TABLE statement"> extends [
		infer DropResult,
		infer RestDrop extends BufferLike,
	]
		? DropResult extends SqlParseError<string>
			? [DropResult, RestDrop]
			: ReadExpectedToken<RestDrop, "table", "Unable to parse DROP TABLE statement"> extends [
						infer TableResult,
						infer RestTable extends BufferLike,
				  ]
				? TableResult extends SqlParseError<string>
					? [TableResult, RestTable]
					: ReadOptionalIfExists<RestTable> extends [true, infer RestFlag extends BufferLike]
						? ParseDropTableWithFlag<true, RestFlag>
						: ReadOptionalIfExists<RestTable> extends [false, infer RestFlag extends BufferLike]
							? ParseDropTableWithFlag<false, RestFlag>
							: ReadOptionalIfExists<RestTable> extends [
										infer FlagError extends SqlParseError<string>,
										infer RestFlag extends BufferLike,
								  ]
								? [FlagError, RestFlag]
								: [SqlParseError<"Unable to parse DROP TABLE statement">, B]
				: [SqlParseError<"Unable to parse DROP TABLE statement">, B]
		: [SqlParseError<"Unable to parse DROP TABLE statement">, B]

type ParseDropTableWithFlag<IfExists extends boolean, B extends BufferLike> =
	ReadQualifiedIdentifierFromBuffer<B> extends [
		infer Name extends SqlQualifiedIdentifier,
		infer RestName extends BufferLike,
	]
		? ConsumeStatementEnd<RestName> extends [true, infer Tail extends BufferLike]
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
