import type {
	ConsumeStatementEnd,
	ReadOptionalIfExists,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-primitives.js"
import type { TokensList, SqlParserError } from "./sql-tokens.js"

export type DropTableStatement = {
	readonly kind: "drop_table"
	readonly target: SqlQualifiedIdentifier
	readonly ifExists: boolean
}

/** `Tokens` must be the buffer immediately after the `table` token (caller routes with `PeekToken` then `SkipToken`). */
export type ParseDropTable<Tokens extends TokensList> = FinalizeDropTableTuple<ParseDropTableTupleAfterTable<Tokens>>

type FinalizeDropTableTuple<T> = T extends [infer E extends SqlParserError<string>, infer R extends TokensList]
	? [E, R]
	: T extends [infer Result, infer Rest extends TokensList]
		? [Result, Rest]
		: never

type ParseDropTableTupleAfterTable<Tokens extends TokensList> =
	ReadOptionalIfExists<Tokens> extends [true, infer RestFlag extends TokensList]
		? ParseDropTableWithFlag<true, RestFlag>
		: ReadOptionalIfExists<Tokens> extends [false, infer RestFlag extends TokensList]
			? ParseDropTableWithFlag<false, RestFlag>
			: ReadOptionalIfExists<Tokens> extends [
						infer FlagError extends SqlParserError<string>,
						infer RestFlag extends TokensList,
				  ]
				? [FlagError, RestFlag]
				: [SqlParserError<"Unable to parse DROP TABLE statement">, Tokens]

type ParseDropTableWithFlag<IfExists extends boolean, Tokens extends TokensList> =
	ReadQualifiedIdentifierFromBuffer<Tokens> extends [
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
			: [SqlParserError<"Unable to parse DROP TABLE statement">, RestName]
		: [SqlParserError<"Unable to parse DROP TABLE statement">, Tokens]
