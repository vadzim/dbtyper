import type { SqlParseError } from "./sql-parse-error.js"
import type {
	ConsumeStatementEnd,
	InitParseBuffer,
	ReadExpectedToken,
	ReadOptionalIfExists,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-parse-primitives.js"
import type { Buffer, ReadToken } from "./sql-tokens.js"

export type SqlDropTableLike = {
	readonly kind: "drop_table"
	readonly target: SqlQualifiedIdentifier
	readonly ifExists: boolean
}

export type SqlDropTable<S extends string> =
	ReadToken<InitParseBuffer<S>> extends ["drop", infer AfterDrop extends Buffer]
		? ReadToken<AfterDrop> extends ["table", Buffer]
			? FinalizeDropTable<ParseDropTableTuple<InitParseBuffer<S>>>
			: never
		: never

type FinalizeDropTable<T> = T extends [infer E extends SqlParseError<string>, Buffer]
	? E
	: T extends [infer Result, infer Rest extends Buffer]
		? ConsumeStatementEnd<Rest> extends [true, infer Tail extends Buffer]
			? ReadToken<Tail> extends ["", Buffer]
				? Result
				: SqlParseError<"Unable to parse DROP TABLE statement">
			: SqlParseError<"Unable to parse DROP TABLE statement">
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
	ReadQualifiedIdentifierFromBuffer<B> extends [infer Name extends SqlQualifiedIdentifier, infer RestName extends Buffer]
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
