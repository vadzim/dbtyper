import type {
	ConsumeStatementEnd,
	ReadExpectedIdentifier,
	ReadExpectedToken,
	ReadOptionalIfExists,
} from "./sql-parse-primitives.js"
import type { BufferLike, PeekToken, SkipToken, SqlParseError } from "./sql-tokens.js"

export type SqlDropSchemaLike = {
	readonly kind: "drop_schema"
	readonly name: string
	readonly ifExists: boolean
}

export type SqlDropSchema<B extends BufferLike> =
	PeekToken<B> extends "drop"
		? PeekToken<SkipToken<B>> extends "schema"
			? FinalizeDropSchemaTuple<ParseDropSchemaTuple<B>>
			: never
		: never

type FinalizeDropSchemaTuple<T> = T extends [infer E extends SqlParseError<string>, infer R extends BufferLike]
	? [E, R]
	: T extends [infer Result, infer Rest extends BufferLike]
		? ConsumeStatementEnd<Rest> extends [true, infer Tail extends BufferLike]
			? PeekToken<Tail> extends ""
				? [Result, Tail]
				: [SqlParseError<"Unable to parse DROP SCHEMA statement">, Rest]
			: [SqlParseError<"Unable to parse DROP SCHEMA statement">, Rest]
		: never

type ParseDropSchemaTuple<B extends BufferLike> =
	ReadExpectedToken<B, "drop", "Unable to parse DROP SCHEMA statement"> extends [
		infer DropResult,
		infer RestDrop extends BufferLike,
	]
		? DropResult extends SqlParseError<string>
			? [DropResult, RestDrop]
			: ReadExpectedToken<RestDrop, "schema", "Unable to parse DROP SCHEMA statement"> extends [
						infer SchemaResult,
						infer RestSchema extends BufferLike,
				  ]
				? SchemaResult extends SqlParseError<string>
					? [SchemaResult, RestSchema]
					: ReadOptionalIfExists<RestSchema> extends [true, infer RestFlag extends BufferLike]
						? ParseDropSchemaWithFlag<true, RestFlag>
						: ReadOptionalIfExists<RestSchema> extends [false, infer RestFlag extends BufferLike]
							? ParseDropSchemaWithFlag<false, RestFlag>
							: ReadOptionalIfExists<RestSchema> extends [
										infer FlagError extends SqlParseError<string>,
										infer RestFlag extends BufferLike,
								  ]
								? [FlagError, RestFlag]
								: [SqlParseError<"Unable to parse DROP SCHEMA statement">, B]
				: [SqlParseError<"Unable to parse DROP SCHEMA statement">, B]
		: [SqlParseError<"Unable to parse DROP SCHEMA statement">, B]

type ParseDropSchemaWithFlag<IfExists extends boolean, B extends BufferLike> =
	ReadExpectedIdentifier<B, "Unable to parse DROP SCHEMA statement"> extends [
		infer NameResult extends string | SqlParseError<string>,
		infer RestName extends BufferLike,
	]
		? NameResult extends SqlParseError<string>
			? [NameResult, RestName]
			: ConsumeStatementEnd<RestName> extends [true, infer Tail extends BufferLike]
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
