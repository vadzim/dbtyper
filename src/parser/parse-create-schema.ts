import type { ConsumeStatementEnd, ReadOptionalIfNotExists } from "./sql-primitives.ts"
import type { TokensList, PeekToken, SkipToken, SqlParserError, TokenIdent } from "../../core/sql-tokens.ts"

export type CreateSchemaStatement = {
	kind: "create_schema"
	name: string
	ifNotExists: boolean
}

export type ParseCreateSchema<Tokens extends TokensList> =
	ReadOptionalIfNotExists<Tokens> extends [
		infer RestFlag extends TokensList,
		infer FlagOrError extends boolean | SqlParserError<string>,
	]
		? FlagOrError extends SqlParserError<string>
			? [RestFlag, FlagOrError]
			: FlagOrError extends true
				? ParseCreateSchemaWithFlag<RestFlag, true>
				: ParseCreateSchemaWithFlag<RestFlag, false>
		: never

type ParseCreateSchemaWithFlag<Tokens extends TokensList, IfNotExists extends boolean> =
	PeekToken<Tokens> extends TokenIdent<infer NameResult extends string>
		? ConsumeStatementEnd<SkipToken<Tokens>> extends [infer Tail extends TokensList, infer EndOk extends boolean]
			? EndOk extends true
				? [
						Tail,
						{
							kind: "create_schema"
							name: NameResult
							ifNotExists: IfNotExists
						},
					]
				: [Tail, SqlParserError<"Unable to parse CREATE SCHEMA statement">]
			: never
		: [Tokens, SqlParserError<"Unable to parse CREATE SCHEMA statement">]
