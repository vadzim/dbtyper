import type { ConsumeStatementEnd, ReadExpectedIdentifier, ReadOptionalIfExists } from "./sql-primitives.ts"
import type { TokensList, SqlParserError } from "../../core/sql-tokens.ts"

export type DropSchemaStatement = {
	kind: "drop_schema"
	name: string
	ifExists: boolean
}

export type ParseDropSchema<Tokens extends TokensList> =
	ReadOptionalIfExists<Tokens> extends [
		infer RestFlag extends TokensList,
		infer FlagOrError extends boolean | SqlParserError<string>,
	]
		? FlagOrError extends SqlParserError<string>
			? [RestFlag, FlagOrError]
			: FlagOrError extends true
				? ParseDropSchemaWithFlag<RestFlag, true>
				: ParseDropSchemaWithFlag<RestFlag, false>
		: never

type ParseDropSchemaWithFlag<Tokens extends TokensList, IfExists extends boolean> =
	ReadExpectedIdentifier<Tokens, "Unable to parse DROP SCHEMA statement"> extends [
		infer RestName extends TokensList,
		infer NameResult extends string | SqlParserError<string>,
	]
		? NameResult extends SqlParserError<string>
			? [RestName, NameResult]
			: ConsumeStatementEnd<RestName> extends [infer Tail extends TokensList, infer EndOk extends boolean]
				? EndOk extends true
					? [
							Tail,
							{
								kind: "drop_schema"
								name: NameResult
								ifExists: IfExists
							},
						]
					: [Tail, SqlParserError<"Unable to parse DROP SCHEMA statement">]
				: never
		: never
