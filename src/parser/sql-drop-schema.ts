import type { SqlParseError } from "./sql-parse-error.js"
import type {
	ConsumeStatementEnd,
	InitParseBuffer,
	ReadExpectedIdentifier,
	ReadExpectedToken,
	ReadOptionalIfExists,
} from "./sql-parse-primitives.js"
import type { Buffer, ReadToken } from "./sql-tokens.js"

export type SqlDropSchemaLike = {
	readonly kind: "drop_schema"
	readonly name: string
	readonly ifExists: boolean
}

export type SqlDropSchema<S extends string> =
	ReadToken<InitParseBuffer<S>> extends ["drop", infer AfterDrop extends Buffer]
		? ReadToken<AfterDrop> extends ["schema", Buffer]
			? FinalizeDropSchema<ParseDropSchemaTuple<InitParseBuffer<S>>>
			: never
		: never

type FinalizeDropSchema<T> = T extends [infer E extends SqlParseError<string>, Buffer]
	? E
	: T extends [infer Result, infer Rest extends Buffer]
		? ConsumeStatementEnd<Rest> extends [true, infer Tail extends Buffer]
			? ReadToken<Tail> extends ["", Buffer]
				? Result
				: SqlParseError<"Unable to parse DROP SCHEMA statement">
			: SqlParseError<"Unable to parse DROP SCHEMA statement">
		: never

type ParseDropSchemaTuple<B extends Buffer> =
	ReadExpectedToken<B, "drop", "Unable to parse DROP SCHEMA statement"> extends [
		infer DropResult,
		infer RestDrop extends Buffer,
	]
		? DropResult extends SqlParseError<string>
			? [DropResult, RestDrop]
			: ReadExpectedToken<RestDrop, "schema", "Unable to parse DROP SCHEMA statement"> extends [
						infer SchemaResult,
						infer RestSchema extends Buffer,
				  ]
				? SchemaResult extends SqlParseError<string>
					? [SchemaResult, RestSchema]
					: ReadOptionalIfExists<RestSchema> extends [true, infer RestFlag extends Buffer]
						? ParseDropSchemaWithFlag<true, RestFlag>
						: ReadOptionalIfExists<RestSchema> extends [false, infer RestFlag extends Buffer]
							? ParseDropSchemaWithFlag<false, RestFlag>
							: ReadOptionalIfExists<RestSchema> extends [
										infer FlagError extends SqlParseError<string>,
										infer RestFlag extends Buffer,
								  ]
								? [FlagError, RestFlag]
								: [SqlParseError<"Unable to parse DROP SCHEMA statement">, B]
				: [SqlParseError<"Unable to parse DROP SCHEMA statement">, B]
		: [SqlParseError<"Unable to parse DROP SCHEMA statement">, B]

type ParseDropSchemaWithFlag<IfExists extends boolean, B extends Buffer> =
	ReadExpectedIdentifier<B, "Unable to parse DROP SCHEMA statement"> extends [
		infer NameResult extends string | SqlParseError<string>,
		infer RestName extends Buffer,
	]
		? NameResult extends SqlParseError<string>
			? [NameResult, RestName]
			: ConsumeStatementEnd<RestName> extends [true, infer Tail extends Buffer]
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
