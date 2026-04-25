import type { ConsumeStatementEnd, ReadOptionalIfExists } from "./sql-primitives.ts"
import type { TokensList, PeekToken, SkipToken, SqlParserError, TokenIdent } from "../../core/sql-tokens.ts"

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
	PeekToken<Tokens> extends TokenIdent<infer NameResult extends string>
		? ConsumeStatementEnd<SkipToken<Tokens>> extends [infer Tail extends TokensList, infer EndOk extends boolean]
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
		: [Tokens, SqlParserError<"Unable to parse DROP SCHEMA statement">]
