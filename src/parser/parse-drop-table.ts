import type {
	ConsumeStatementEnd,
	ReadOptionalIfExists,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-primitives.ts"
import type { TokensList, SqlParserError } from "../../core/sql-tokens.ts"

export type DropTableStatement = {
	kind: "drop_table"
	target: SqlQualifiedIdentifier
	ifExists: boolean
}

export type ParseDropTable<Tokens extends TokensList> =
	ReadOptionalIfExists<Tokens> extends [
		infer RestFlag extends TokensList,
		infer FlagOrError extends boolean | SqlParserError<string>,
	]
		? FlagOrError extends SqlParserError<string>
			? [RestFlag, FlagOrError]
			: FlagOrError extends true
				? ParseDropTableWithFlag<RestFlag, true>
				: ParseDropTableWithFlag<RestFlag, false>
		: never

type ParseDropTableWithFlag<Tokens extends TokensList, IfExists extends boolean> =
	ReadQualifiedIdentifierFromBuffer<Tokens> extends [
		infer RestName extends TokensList,
		infer NameResult extends SqlQualifiedIdentifier | SqlParserError<string>,
	]
		? NameResult extends SqlParserError<string>
			? [RestName, SqlParserError<"Unable to parse DROP TABLE statement">]
			: ConsumeStatementEnd<RestName> extends [infer Tail extends TokensList, infer EndOk extends boolean]
				? EndOk extends true
					? [
							Tail,
							{
								kind: "drop_table"
								ifExists: IfExists
								target: NameResult
							},
						]
					: [Tail, SqlParserError<"Unable to parse DROP TABLE statement">]
				: never
		: never
