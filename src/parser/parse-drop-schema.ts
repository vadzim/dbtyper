import type { ConsumeStatementEnd, ReadExpectedIdentifier, ReadOptionalIfExists } from "./sql-primitives.js"
import type { TokensList, EmptyTokenList, SqlParserError } from "./sql-tokens.js"

export type DropSchemaStatement = {
	readonly kind: "drop_schema"
	readonly name: string
	readonly ifExists: boolean
}

/** `Tokens` must be the buffer immediately after the `schema` token (caller routes with `PeekToken` then `SkipToken`). */
export type ParseDropSchema<Tokens extends TokensList> = FinalizeDropSchemaTuple<
	ParseDropSchemaTupleAfterSchema<Tokens>
>

type FinalizeDropSchemaTuple<T> = T extends [infer E extends SqlParserError<string>, infer R extends TokensList]
	? [E, R]
	: T extends [infer Result, infer Rest extends TokensList]
		? [Result, Rest]
		: never

type ParseDropSchemaTupleAfterSchema<Tokens extends TokensList> =
	ReadOptionalIfExists<Tokens> extends [
		infer FlagOrError extends boolean | SqlParserError<string>,
		infer RestFlag extends TokensList,
	]
		? FlagOrError extends SqlParserError<string>
			? [FlagOrError, RestFlag]
			: FlagOrError extends true
				? ParseDropSchemaWithFlag<true, RestFlag>
				: ParseDropSchemaWithFlag<false, RestFlag>
		: [SqlParserError<"Unable to parse DROP SCHEMA statement">, EmptyTokenList]

type ParseDropSchemaWithFlag<IfExists extends boolean, Tokens extends TokensList> =
	ReadExpectedIdentifier<Tokens, "Unable to parse DROP SCHEMA statement"> extends [
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
				: [SqlParserError<"Unable to parse DROP SCHEMA statement">, EmptyTokenList]
		: [SqlParserError<"Unable to parse DROP SCHEMA statement">, EmptyTokenList]
