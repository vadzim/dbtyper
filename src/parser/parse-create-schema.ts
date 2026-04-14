import type { ConsumeStatementEnd, ReadExpectedIdentifier, ReadOptionalIfNotExists } from "./sql-primitives.js"
import type { TokensList, EmptyTokenList, SqlParserError } from "./sql-tokens.js"

export type CreateSchemaStatement = {
	readonly kind: "create_schema"
	readonly name: string
	readonly ifNotExists: boolean
}

/** `Tokens` must be the buffer immediately after the `schema` token (caller routes with `PeekToken` then `SkipToken`). */
export type ParseCreateSchema<Tokens extends TokensList> = FinalizeCreateSchemaTuple<
	ParseCreateSchemaTupleAfterSchema<Tokens>
>

type FinalizeCreateSchemaTuple<T> = T extends [infer E extends SqlParserError<string>, infer R extends TokensList]
	? [E, R]
	: T extends [infer Result, infer Rest extends TokensList]
		? [Result, Rest]
		: never

type ParseCreateSchemaTupleAfterSchema<Tokens extends TokensList> =
	ReadOptionalIfNotExists<Tokens> extends [
		infer FlagOrError extends boolean | SqlParserError<string>,
		infer RestFlag extends TokensList,
	]
		? FlagOrError extends SqlParserError<string>
			? [FlagOrError, RestFlag]
			: FlagOrError extends true
				? ParseCreateSchemaWithFlag<true, RestFlag>
				: ParseCreateSchemaWithFlag<false, RestFlag>
		: [SqlParserError<"Unable to parse CREATE SCHEMA statement">, EmptyTokenList]

type ParseCreateSchemaWithFlag<IfNotExists extends boolean, Tokens extends TokensList> =
	ReadExpectedIdentifier<Tokens, "Unable to parse CREATE SCHEMA statement"> extends [
		infer NameResult extends string | SqlParserError<string>,
		infer RestName extends TokensList,
	]
		? NameResult extends SqlParserError<string>
			? [NameResult, RestName]
			: ConsumeStatementEnd<RestName> extends [true, infer Tail extends TokensList]
				? [
						{
							readonly kind: "create_schema"
							readonly name: NameResult
							readonly ifNotExists: IfNotExists
						},
						Tail,
					]
				: [SqlParserError<"Unable to parse CREATE SCHEMA statement">, EmptyTokenList]
		: [SqlParserError<"Unable to parse CREATE SCHEMA statement">, EmptyTokenList]
