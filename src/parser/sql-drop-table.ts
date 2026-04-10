import type {
	ConsumeStatementEnd,
	ReadExpectedToken,
	ReadOptionalIfExists,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-parse-primitives.js"
import type { Buffer, ReadToken, SqlParseError } from "./sql-tokens.js"

export type SqlDropTableLike = {
	readonly kind: "drop_table"
	readonly target: SqlQualifiedIdentifier
	readonly ifExists: boolean
}

export type SqlDropTable<B extends Buffer> =
	ReadToken<B> extends ["drop", infer AfterDrop extends Buffer]
		? ReadToken<AfterDrop> extends ["table", Buffer]
			? FinalizeDropTableTuple<ParseDropTableTuple<B>>
			: never
		: never

type FinalizeDropTableTuple<T> = T extends [infer E extends SqlParseError<string>, infer R extends Buffer]
	? [E, R]
	: T extends [infer Result, infer Rest extends Buffer]
		? ConsumeStatementEnd<Rest> extends [true, infer Tail extends Buffer]
			? ReadToken<Tail> extends ["", Buffer]
				? [Result, Tail]
				: [SqlParseError<"Unable to parse DROP TABLE statement">, Rest]
			: [SqlParseError<"Unable to parse DROP TABLE statement">, Rest]
		: never

type ParseDropTableTuple<B extends Buffer> =
	ReadExpectedToken<B, "drop", "Unable to parse DROP TABLE statement"> extends [
		infer DropResult,
		infer RestDrop extends Buffer,
	]
		? DropResult extends SqlParseError<string>
			? [DropResult, RestDrop]
			: ReadExpectedToken<RestDrop, "table", "Unable to parse DROP TABLE statement"> extends [
						infer TableResult,
						infer RestTable extends Buffer,
				  ]
				? TableResult extends SqlParseError<string>
					? [TableResult, RestTable]
					: ReadOptionalIfExists<RestTable> extends [true, infer RestFlag extends Buffer]
						? ParseDropTableWithFlag<true, RestFlag>
						: ReadOptionalIfExists<RestTable> extends [false, infer RestFlag extends Buffer]
							? ParseDropTableWithFlag<false, RestFlag>
							: ReadOptionalIfExists<RestTable> extends [
										infer FlagError extends SqlParseError<string>,
										infer RestFlag extends Buffer,
								  ]
								? [FlagError, RestFlag]
								: [SqlParseError<"Unable to parse DROP TABLE statement">, B]
				: [SqlParseError<"Unable to parse DROP TABLE statement">, B]
		: [SqlParseError<"Unable to parse DROP TABLE statement">, B]

type ParseDropTableWithFlag<IfExists extends boolean, B extends Buffer> =
	ReadQualifiedIdentifierFromBuffer<B> extends [
		infer Name extends SqlQualifiedIdentifier,
		infer RestName extends Buffer,
	]
		? ConsumeStatementEnd<RestName> extends [true, infer Tail extends Buffer]
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
