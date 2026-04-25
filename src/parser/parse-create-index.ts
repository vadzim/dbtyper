import type { ParseColumnList } from "./sql-constraints-fk.ts"
import type { SkippedStatement, SkipStatement } from "./skip-statement.ts"
import type {
	ReadExpectedToken,
	ReadOptionalIfNotExists,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-primitives.ts"
import type { TokensList, PeekToken, SkipToken, SqlParserError, TokenType } from "../../core/sql-tokens.ts"

export type CreateIndexStatement = {
	kind: "create_index_validated"
	unique: boolean
	ifNotExists: boolean
	target: SqlQualifiedIdentifier
	columns: string[]
}

export type ParseCreateIndex<Tokens extends TokensList, Unique extends boolean = false> =
	ReadOptionalIfNotExists<Tokens> extends [
		infer Rest0 extends TokensList,
		infer IfNotExists extends boolean | SqlParserError<string>,
	]
		? IfNotExists extends SqlParserError<string>
			? [Rest0, IfNotExists]
			: IfNotExists extends boolean
				? ParseCreateIndexAfterIfNotExists<Rest0, Unique, IfNotExists>
				: never
		: never

type ParseCreateIndexAfterIfNotExists<Tokens extends TokensList, Unique extends boolean, IfNotExists extends boolean> =
	PeekToken<Tokens> extends TokenType<"ident", string>
		? ParseCreateIndexAfterOn<SkipToken<Tokens>, Unique, IfNotExists>
		: [Tokens, SqlParserError<"Expected index name in CREATE INDEX">]

type ParseCreateIndexAfterOn<Tokens extends TokensList, Unique extends boolean, IfNotExists extends boolean> =
	ReadExpectedToken<Tokens, "on", "Expected ON in CREATE INDEX"> extends [infer Rest2 extends TokensList, infer OkOn]
		? OkOn extends true
			? ReadQualifiedIdentifierFromBuffer<Rest2> extends [
					infer Rest3 extends TokensList,
					infer TableResult extends SqlQualifiedIdentifier | SqlParserError<string>,
				]
				? TableResult extends SqlParserError<string>
					? [Rest3, SqlParserError<"Unable to parse CREATE INDEX">]
					: ParseColumnList<Rest3> extends [infer Tail extends TokensList, infer ColsResult]
						? ColsResult extends string[]
							? SkipStatement<Tail> extends [infer RestFinal extends TokensList, infer SkipResult]
								? SkipResult extends SkippedStatement
									? [
											RestFinal,
											{
												kind: "create_index_validated"
												unique: Unique
												ifNotExists: IfNotExists
												target: TableResult
												columns: ColsResult
											},
										]
									: [RestFinal, SqlParserError<"Unable to parse CREATE INDEX">]
								: never
							: [Tail, SqlParserError<"Unable to parse CREATE INDEX column list">]
						: never
				: never
			: OkOn extends SqlParserError<string>
				? [Rest2, OkOn]
				: never
		: never
