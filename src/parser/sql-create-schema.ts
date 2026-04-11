import type {
	ConsumeStatementEnd,
	ReadExpectedIdentifier,
	ReadExpectedToken,
	ReadOptionalIfNotExists,
} from "./sql-parse-primitives.js"
import type { BufferLike, ReadToken, SqlParseError } from "./sql-tokens.js"

export type SqlCreateSchemaLike = {
	readonly kind: "create_schema"
	readonly name: string
	readonly ifNotExists: boolean
}

export type SqlCreateSchema<B extends BufferLike> =
	ReadToken<B> extends ["create", infer AfterCreate extends BufferLike]
		? ReadToken<AfterCreate> extends ["schema", BufferLike]
			? FinalizeCreateSchemaTuple<ParseCreateSchemaTuple<B>>
			: never
		: never

type FinalizeCreateSchemaTuple<T> = T extends [infer E extends SqlParseError<string>, infer R extends BufferLike]
	? [E, R]
	: T extends [infer Result, infer Rest extends BufferLike]
		? ConsumeStatementEnd<Rest> extends [true, infer Tail extends BufferLike]
			? ReadToken<Tail> extends ["", BufferLike]
				? [Result, Tail]
				: [SqlParseError<"Unable to parse CREATE SCHEMA statement">, Rest]
			: [SqlParseError<"Unable to parse CREATE SCHEMA statement">, Rest]
		: never

type ParseCreateSchemaTuple<B extends BufferLike> =
	ReadExpectedToken<B, "create", "Unable to parse CREATE SCHEMA statement"> extends [
		infer CreateResult,
		infer RestCreate extends BufferLike,
	]
		? CreateResult extends SqlParseError<string>
			? [CreateResult, RestCreate]
			: ReadExpectedToken<RestCreate, "schema", "Unable to parse CREATE SCHEMA statement"> extends [
						infer SchemaResult,
						infer RestSchema extends BufferLike,
				  ]
				? SchemaResult extends SqlParseError<string>
					? [SchemaResult, RestSchema]
					: ReadOptionalIfNotExists<RestSchema> extends [true, infer RestFlag extends BufferLike]
						? ParseCreateSchemaWithFlag<true, RestFlag>
						: ReadOptionalIfNotExists<RestSchema> extends [false, infer RestFlag extends BufferLike]
							? ParseCreateSchemaWithFlag<false, RestFlag>
							: ReadOptionalIfNotExists<RestSchema> extends [
										infer FlagError extends SqlParseError<string>,
										infer RestFlag extends BufferLike,
								  ]
								? [FlagError, RestFlag]
								: [SqlParseError<"Unable to parse CREATE SCHEMA statement">, B]
				: [SqlParseError<"Unable to parse CREATE SCHEMA statement">, B]
		: [SqlParseError<"Unable to parse CREATE SCHEMA statement">, B]

type ParseCreateSchemaWithFlag<IfNotExists extends boolean, B extends BufferLike> =
	ReadExpectedIdentifier<B, "Unable to parse CREATE SCHEMA statement"> extends [
		infer NameResult extends string | SqlParseError<string>,
		infer RestName extends BufferLike,
	]
		? NameResult extends SqlParseError<string>
			? [NameResult, RestName]
			: ConsumeStatementEnd<RestName> extends [true, infer Tail extends BufferLike]
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
