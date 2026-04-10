import type { SqlParseError } from "./sql-parse-error.js"
import type {
	ConsumeStatementEnd,
	InitParseBuffer,
	ReadExpectedIdentifier,
	ReadExpectedToken,
	ReadOptionalIfNotExists,
} from "./sql-parse-primitives.js"
import type { Buffer, ReadToken } from "./sql-tokens.js"

export type SqlCreateSchemaLike = {
	readonly kind: "create_schema"
	readonly name: string
	readonly ifNotExists: boolean
}

export type SqlCreateSchema<S extends string> =
	ReadToken<InitParseBuffer<S>> extends ["create", infer AfterCreate extends Buffer]
		? ReadToken<AfterCreate> extends ["schema", Buffer]
			? FinalizeCreateSchema<ParseCreateSchemaTuple<InitParseBuffer<S>>>
			: never
		: never

type FinalizeCreateSchema<T> = T extends [infer E extends SqlParseError<string>, Buffer]
	? E
	: T extends [infer Result, infer Rest extends Buffer]
		? ConsumeStatementEnd<Rest> extends [true, infer Tail extends Buffer]
			? ReadToken<Tail> extends ["", Buffer]
				? Result
				: SqlParseError<"Unable to parse CREATE SCHEMA statement">
			: SqlParseError<"Unable to parse CREATE SCHEMA statement">
			: never

type ParseCreateSchemaTuple<B extends Buffer> =
	ReadExpectedToken<B, "create", "Unable to parse CREATE SCHEMA statement"> extends [
		infer CreateResult,
		infer RestCreate extends Buffer,
	]
		? CreateResult extends SqlParseError<string>
			? [CreateResult, RestCreate]
			: ReadExpectedToken<RestCreate, "schema", "Unable to parse CREATE SCHEMA statement"> extends [
					infer SchemaResult,
					infer RestSchema extends Buffer,
				]
				? SchemaResult extends SqlParseError<string>
					? [SchemaResult, RestSchema]
					: ReadOptionalIfNotExists<RestSchema> extends [true, infer RestFlag extends Buffer]
						? ParseCreateSchemaWithFlag<true, RestFlag>
						: ReadOptionalIfNotExists<RestSchema> extends [false, infer RestFlag extends Buffer]
							? ParseCreateSchemaWithFlag<false, RestFlag>
							: ReadOptionalIfNotExists<RestSchema> extends [
									  infer FlagError extends SqlParseError<string>,
									  infer RestFlag extends Buffer,
								  ]
								? [FlagError, RestFlag]
								: [SqlParseError<"Unable to parse CREATE SCHEMA statement">, B]
				: [SqlParseError<"Unable to parse CREATE SCHEMA statement">, B]
		: [SqlParseError<"Unable to parse CREATE SCHEMA statement">, B]

type ParseCreateSchemaWithFlag<IfNotExists extends boolean, B extends Buffer> =
	ReadExpectedIdentifier<B, "Unable to parse CREATE SCHEMA statement"> extends [
		infer NameResult extends string | SqlParseError<string>,
		infer RestName extends Buffer,
	]
		? NameResult extends SqlParseError<string>
			? [NameResult, RestName]
			: ConsumeStatementEnd<RestName> extends [true, infer Tail extends Buffer]
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
