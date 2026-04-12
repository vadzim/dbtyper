import type { ConsumeStatementEnd, ReadExpectedIdentifier, ReadOptionalIfExists } from "./sql-parse-primitives.js"
import type { TokensList, SqlParserError } from "./sql-tokens.js"

export type DropSchemaStatement = {
	readonly kind: "drop_schema"
	readonly name: string
	readonly ifExists: boolean
}

/** `B` must be the buffer immediately after the `schema` token (caller routes with `PeekToken` then `SkipToken`). */
export type ParseDropSchema<B extends TokensList> = FinalizeDropSchemaTuple<ParseDropSchemaTupleAfterSchema<B>>

type FinalizeDropSchemaTuple<T> = T extends [infer E extends SqlParserError<string>, infer R extends TokensList]
	? [E, R]
	: T extends [infer Result, infer Rest extends TokensList]
		? [Result, Rest]
		: never

type ParseDropSchemaTupleAfterSchema<B extends TokensList> =
	ReadOptionalIfExists<B> extends [true, infer RestFlag extends TokensList]
		? ParseDropSchemaWithFlag<true, RestFlag>
		: ReadOptionalIfExists<B> extends [false, infer RestFlag extends TokensList]
			? ParseDropSchemaWithFlag<false, RestFlag>
			: ReadOptionalIfExists<B> extends [
						infer FlagError extends SqlParserError<string>,
						infer RestFlag extends TokensList,
				  ]
				? [FlagError, RestFlag]
				: [SqlParserError<"Unable to parse DROP SCHEMA statement">, B]

type ParseDropSchemaWithFlag<IfExists extends boolean, B extends TokensList> =
	ReadExpectedIdentifier<B, "Unable to parse DROP SCHEMA statement"> extends [
		infer NameResult extends string | SqlParserError<string>,
		infer RestName extends TokensList,
	]
		? NameResult extends SqlParserError<string>
			? [NameResult, RestName]
			: ConsumeStatementEnd<RestName> extends [true, infer Tail extends TokensList]
				? [
						{
							readonly kind: "drop_schema"
							readonly name: NameResult
							readonly ifExists: IfExists
						},
						Tail,
					]
				: [SqlParserError<"Unable to parse DROP SCHEMA statement">, RestName]
		: [SqlParserError<"Unable to parse DROP SCHEMA statement">, B]
