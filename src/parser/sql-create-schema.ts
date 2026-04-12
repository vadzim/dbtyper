import type { ConsumeStatementEnd, ReadExpectedIdentifier, ReadOptionalIfNotExists } from "./sql-parse-primitives.js"
import type { TokensList, SqlParseError } from "./sql-tokens.js"

export type SqlCreateSchema = {
	readonly kind: "create_schema"
	readonly name: string
	readonly ifNotExists: boolean
}

/** `B` must be the buffer immediately after the `schema` token (caller routes with `PeekToken` then `SkipToken`). */
export type ParseCreateSchema<B extends TokensList> = FinalizeCreateSchemaTuple<ParseCreateSchemaTupleAfterSchema<B>>

type FinalizeCreateSchemaTuple<T> = T extends [infer E extends SqlParseError<string>, infer R extends TokensList]
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
						infer FlagError extends SqlParseError<string>,
						infer RestFlag extends TokensList,
				  ]
				? [FlagError, RestFlag]
				: [SqlParseError<"Unable to parse CREATE SCHEMA statement">, B]

type ParseCreateSchemaWithFlag<IfNotExists extends boolean, B extends TokensList> =
	ReadExpectedIdentifier<B, "Unable to parse CREATE SCHEMA statement"> extends [
		infer NameResult extends string | SqlParseError<string>,
		infer RestName extends TokensList,
	]
		? NameResult extends SqlParseError<string>
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
				: [SqlParseError<"Unable to parse CREATE SCHEMA statement">, RestName]
		: [SqlParseError<"Unable to parse CREATE SCHEMA statement">, B]
