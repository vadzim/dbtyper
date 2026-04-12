import type {
	ConsumeStatementEnd,
	ReadOptionalIfExists,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-parse-primitives.js"
import type { TokensList, SqlParseError } from "./sql-tokens.js"

export type SqlDropTable = {
	readonly kind: "drop_table"
	readonly target: SqlQualifiedIdentifier
	readonly ifExists: boolean
}

/** `B` must be the buffer immediately after the `table` token (caller routes with `PeekToken` then `SkipToken`). */
export type ParseDropTable<B extends TokensList> = FinalizeDropTableTuple<ParseDropTableTupleAfterTable<B>>

type FinalizeDropTableTuple<T> = T extends [infer E extends SqlParseError<string>, infer R extends TokensList]
	? [E, R]
	: T extends [infer Result, infer Rest extends TokensList]
		? [Result, Rest]
		: never

type ParseDropTableTupleAfterTable<B extends TokensList> =
	ReadOptionalIfExists<B> extends [true, infer RestFlag extends TokensList]
		? ParseDropTableWithFlag<true, RestFlag>
		: ReadOptionalIfExists<B> extends [false, infer RestFlag extends TokensList]
			? ParseDropTableWithFlag<false, RestFlag>
			: ReadOptionalIfExists<B> extends [
						infer FlagError extends SqlParseError<string>,
						infer RestFlag extends TokensList,
				  ]
				? [FlagError, RestFlag]
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
