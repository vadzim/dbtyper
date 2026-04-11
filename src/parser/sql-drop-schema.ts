import type {
	ConsumeStatementEnd,
	ReadExpectedIdentifier,
	ReadExpectedToken,
	ReadOptionalIfExists,
} from "./sql-parse-primitives.js"
import type { TokensList, PeekToken, SkipToken, SqlParseError } from "./sql-tokens.js"

export type SqlDropSchemaLike = {
	readonly kind: "drop_schema"
	readonly name: string
	readonly ifExists: boolean
}

export type SqlDropSchema<B extends TokensList> =
	PeekToken<B> extends "drop"
		? PeekToken<SkipToken<B>> extends "schema"
			? FinalizeDropSchemaTuple<ParseDropSchemaTuple<B>>
			: never
		: never

type FinalizeDropSchemaTuple<T> = T extends [infer E extends SqlParseError<string>, infer R extends TokensList]
	? [E, R]
	: T extends [infer Result, infer Rest extends TokensList]
		? [Result, Rest]
		: never

type ParseDropSchemaTuple<B extends TokensList> =
	ReadExpectedToken<B, "drop", "Unable to parse DROP SCHEMA statement"> extends [
		infer DropResult,
		infer RestDrop extends TokensList,
	]
		? DropResult extends SqlParseError<string>
			? [DropResult, RestDrop]
			: ReadExpectedToken<RestDrop, "schema", "Unable to parse DROP SCHEMA statement"> extends [
						infer SchemaResult,
						infer RestSchema extends TokensList,
				  ]
				? SchemaResult extends SqlParseError<string>
					? [SchemaResult, RestSchema]
					: ReadOptionalIfExists<RestSchema> extends [true, infer RestFlag extends TokensList]
						? ParseDropSchemaWithFlag<true, RestFlag>
						: ReadOptionalIfExists<RestSchema> extends [false, infer RestFlag extends TokensList]
							? ParseDropSchemaWithFlag<false, RestFlag>
							: ReadOptionalIfExists<RestSchema> extends [
										infer FlagError extends SqlParseError<string>,
										infer RestFlag extends TokensList,
								  ]
								? [FlagError, RestFlag]
								: [SqlParseError<"Unable to parse DROP SCHEMA statement">, B]
				: [SqlParseError<"Unable to parse DROP SCHEMA statement">, B]
		: [SqlParseError<"Unable to parse DROP SCHEMA statement">, B]

type ParseDropSchemaWithFlag<IfExists extends boolean, B extends TokensList> =
	ReadExpectedIdentifier<B, "Unable to parse DROP SCHEMA statement"> extends [
		infer NameResult extends string | SqlParseError<string>,
		infer RestName extends TokensList,
	]
		? NameResult extends SqlParseError<string>
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
				: [SqlParseError<"Unable to parse DROP SCHEMA statement">, RestName]
		: [SqlParseError<"Unable to parse DROP SCHEMA statement">, B]
