import type { ConsumeStatementEnd, ReadExpectedIdentifier, ReadOptionalIfNotExists } from "./sql-parse-primitives.js"
import type { TokensList, SqlParserError } from "./sql-tokens.js"

export type CreateSchemaStatement = {
	readonly kind: "create_schema"
	readonly name: string
	readonly ifNotExists: boolean
}

/** `B` must be the buffer immediately after the `schema` token (caller routes with `PeekToken` then `SkipToken`). */
export type ParseCreateSchema<B extends TokensList> = FinalizeCreateSchemaTuple<ParseCreateSchemaTupleAfterSchema<B>>

type FinalizeCreateSchemaTuple<T> = T extends [infer E extends SqlParserError<string>, infer R extends TokensList]
	? [E, R]
	: T extends [infer Result, infer Rest extends TokensList]
		? [Result, Rest]
		: never

type ParseCreateSchemaTupleAfterSchema<B extends TokensList> =
	ReadOptionalIfNotExists<B> extends [true, infer RestFlag extends TokensList]
		? ParseCreateSchemaWithFlag<true, RestFlag>
		: ReadOptionalIfNotExists<B> extends [false, infer RestFlag extends TokensList]
			? ParseCreateSchemaWithFlag<false, RestFlag>
			: ReadOptionalIfNotExists<B> extends [
						infer FlagError extends SqlParserError<string>,
						infer RestFlag extends TokensList,
				  ]
				? [FlagError, RestFlag]
				: [SqlParserError<"Unable to parse CREATE SCHEMA statement">, B]

type ParseCreateSchemaWithFlag<IfNotExists extends boolean, B extends TokensList> =
	ReadExpectedIdentifier<B, "Unable to parse CREATE SCHEMA statement"> extends [
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
				: [SqlParserError<"Unable to parse CREATE SCHEMA statement">, RestName]
		: [SqlParserError<"Unable to parse CREATE SCHEMA statement">, B]
