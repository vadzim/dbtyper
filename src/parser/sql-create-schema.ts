import type {
	ConsumeStatementEnd,
	ReadExpectedIdentifier,
	ReadExpectedToken,
	ReadOptionalIfNotExists,
} from "./sql-parse-primitives.js"
import type { TokensList, PeekToken, SkipToken, SqlParseError } from "./sql-tokens.js"

export type SqlCreateSchemaLike = {
	readonly kind: "create_schema"
	readonly name: string
	readonly ifNotExists: boolean
}

export type SqlCreateSchema<B extends TokensList> =
	PeekToken<B> extends "create"
		? PeekToken<SkipToken<B>> extends "schema"
			? FinalizeCreateSchemaTuple<ParseCreateSchemaTuple<B>>
			: never
		: never

type FinalizeCreateSchemaTuple<T> = T extends [infer E extends SqlParseError<string>, infer R extends TokensList]
	? [E, R]
	: T extends [infer Result, infer Rest extends TokensList]
		? [Result, Rest]
		: never

type ParseCreateSchemaTuple<B extends TokensList> =
	ReadExpectedToken<B, "create", "Unable to parse CREATE SCHEMA statement"> extends [
		infer CreateResult,
		infer RestCreate extends TokensList,
	]
		? CreateResult extends SqlParseError<string>
			? [CreateResult, RestCreate]
			: ReadExpectedToken<RestCreate, "schema", "Unable to parse CREATE SCHEMA statement"> extends [
						infer SchemaResult,
						infer RestSchema extends TokensList,
				  ]
				? SchemaResult extends SqlParseError<string>
					? [SchemaResult, RestSchema]
					: ReadOptionalIfNotExists<RestSchema> extends [true, infer RestFlag extends TokensList]
						? ParseCreateSchemaWithFlag<true, RestFlag>
						: ReadOptionalIfNotExists<RestSchema> extends [false, infer RestFlag extends TokensList]
							? ParseCreateSchemaWithFlag<false, RestFlag>
							: ReadOptionalIfNotExists<RestSchema> extends [
										infer FlagError extends SqlParseError<string>,
										infer RestFlag extends TokensList,
								  ]
								? [FlagError, RestFlag]
								: [SqlParseError<"Unable to parse CREATE SCHEMA statement">, B]
				: [SqlParseError<"Unable to parse CREATE SCHEMA statement">, B]
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
