import type { SqlParseError } from "./sql-parse-error.js"
import type {
	ConsumeStatementEnd,
	ReadExpectedIdentifier,
	ReadExpectedToken,
	ReadOptionalIfNotExists,
	Trim,
} from "./sql-parse-primitives.js"
import type { ReadToken } from "./sql-tokens.js"

export type SqlCreateSchemaLike = {
	readonly kind: "create_schema"
	readonly name: string
	readonly ifNotExists: boolean
}

export type SqlCreateSchema<S extends string> =
	ReadToken<S> extends ["create", infer AfterCreate extends string]
		? ReadToken<AfterCreate> extends ["schema", string]
			? FinalizeCreateSchema<ParseCreateSchemaTuple<S>>
			: never
		: never

type FinalizeCreateSchema<T> = T extends [infer E extends SqlParseError<string>, string]
	? E
	: T extends [infer Result, infer Rest extends string]
		? ConsumeStatementEnd<Rest> extends [true, infer Tail extends string]
			? ReadToken<Tail> extends ["", string]
				? Result
				: SqlParseError<"Unable to parse CREATE SCHEMA statement">
			: SqlParseError<"Unable to parse CREATE SCHEMA statement">
			: never

type ParseCreateSchemaTuple<S extends string> =
	ReadExpectedToken<S, "create", "Unable to parse CREATE SCHEMA statement"> extends [
		infer CreateResult,
		infer RestCreate extends string,
	]
		? CreateResult extends SqlParseError<string>
			? [CreateResult, RestCreate]
			: ReadExpectedToken<RestCreate, "schema", "Unable to parse CREATE SCHEMA statement"> extends [
					infer SchemaResult,
					infer RestSchema extends string,
				]
				? SchemaResult extends SqlParseError<string>
					? [SchemaResult, RestSchema]
					: ReadOptionalIfNotExists<RestSchema> extends [true, infer RestFlag extends string]
						? ParseCreateSchemaWithFlag<true, RestFlag>
						: ReadOptionalIfNotExists<RestSchema> extends [false, infer RestFlag extends string]
							? ParseCreateSchemaWithFlag<false, RestFlag>
							: ReadOptionalIfNotExists<RestSchema> extends [
									  infer FlagError extends SqlParseError<string>,
									  infer RestFlag extends string,
								  ]
								? [FlagError, RestFlag]
								: [SqlParseError<"Unable to parse CREATE SCHEMA statement">, S]
				: [SqlParseError<"Unable to parse CREATE SCHEMA statement">, S]
		: [SqlParseError<"Unable to parse CREATE SCHEMA statement">, S]

type ParseCreateSchemaWithFlag<IfNotExists extends boolean, S extends string> =
	ReadExpectedIdentifier<S, "Unable to parse CREATE SCHEMA statement"> extends [
		infer NameResult extends string | SqlParseError<string>,
		infer RestName extends string,
	]
		? NameResult extends SqlParseError<string>
			? [NameResult, RestName]
			: ConsumeStatementEnd<RestName> extends [true, infer Tail extends string]
				? [
						{
							readonly kind: "create_schema"
							readonly name: NameResult
							readonly ifNotExists: IfNotExists
						},
						Trim<Tail>,
					]
				: [SqlParseError<"Unable to parse CREATE SCHEMA statement">, Trim<RestName>]
		: [SqlParseError<"Unable to parse CREATE SCHEMA statement">, S]
