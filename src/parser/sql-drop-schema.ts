import type { SqlParseError } from "./sql-parse-error.js"
import type {
	IsTokenRestEmpty,
	ReadExpectedIdentifier,
	ReadExpectedToken,
	ReadOptionalIfExists,
	Trim,
} from "./sql-parse-primitives.js"
import type { ReadToken } from "./sql-tokens.js"

export type SqlDropSchemaLike = {
	readonly kind: "drop_schema"
	readonly name: string
	readonly ifExists: boolean
}

export type SqlDropSchema<S extends string> =
	ReadToken<S> extends ["drop", infer AfterDrop extends string]
		? ReadToken<AfterDrop> extends ["schema", string]
			? FinalizeDropSchema<ParseDropSchemaTuple<S>>
			: never
		: never

type FinalizeDropSchema<T> = T extends [infer E extends SqlParseError<string>, string]
	? E
	: T extends [infer Result, infer Rest extends string]
		? IsTokenRestEmpty<Rest> extends true
			? Result
			: SqlParseError<"Unable to parse DROP SCHEMA statement">
		: never

type ParseDropSchemaTuple<S extends string> =
	ReadExpectedToken<S, "drop", "Unable to parse DROP SCHEMA statement"> extends [
		infer DropResult,
		infer RestDrop extends string,
	]
		? DropResult extends SqlParseError<string>
			? [DropResult, RestDrop]
			: ReadExpectedToken<RestDrop, "schema", "Unable to parse DROP SCHEMA statement"> extends [
					infer SchemaResult,
					infer RestSchema extends string,
				]
				? SchemaResult extends SqlParseError<string>
					? [SchemaResult, RestSchema]
					: ReadOptionalIfExists<RestSchema> extends [true, infer RestFlag extends string]
						? ParseDropSchemaWithFlag<true, RestFlag>
						: ReadOptionalIfExists<RestSchema> extends [false, infer RestFlag extends string]
							? ParseDropSchemaWithFlag<false, RestFlag>
							: ReadOptionalIfExists<RestSchema> extends [
									  infer FlagError extends SqlParseError<string>,
									  infer RestFlag extends string,
								  ]
								? [FlagError, RestFlag]
								: [SqlParseError<"Unable to parse DROP SCHEMA statement">, S]
				: [SqlParseError<"Unable to parse DROP SCHEMA statement">, S]
		: [SqlParseError<"Unable to parse DROP SCHEMA statement">, S]

type ParseDropSchemaWithFlag<IfExists extends boolean, S extends string> =
	ReadExpectedIdentifier<S, "Unable to parse DROP SCHEMA statement"> extends [
		infer NameResult extends string | SqlParseError<string>,
		infer RestName extends string,
	]
		? NameResult extends SqlParseError<string>
			? [NameResult, RestName]
			: IsTokenRestEmpty<RestName> extends true
				? [
						{
							readonly kind: "drop_schema"
							readonly name: NameResult
							readonly ifExists: IfExists
						},
						"",
					]
				: [SqlParseError<"Unable to parse DROP SCHEMA statement">, Trim<RestName>]
		: [SqlParseError<"Unable to parse DROP SCHEMA statement">, S]
