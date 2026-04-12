import type { ParseColumnListToTuple } from "./sql-constraints-fk.js"
import type { IgnorableStatement } from "./sql-ignorable.js"
import type {
	ReadExpectedIdentifier,
	ReadExpectedToken,
	ReadFirstParenGroup,
	ReadOptionalIfNotExists,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-parse-primitives.js"
import type { SkipStatement } from "./sql-skip-statement.js"
import type { TokensList, EmptyTokenList, SqlParserError } from "./sql-tokens.js"

export type CreateIndexStatement = {
	readonly kind: "create_index_validated"
	readonly unique: boolean
	readonly ifNotExists: boolean
	readonly target: SqlQualifiedIdentifier
	readonly columns: readonly string[]
}

/** `B` is immediately after the `index` token. `Unique` is true for `CREATE UNIQUE INDEX`. */
export type ParseCreateIndex<B extends TokensList, Unique extends boolean = false> = FinalizeCreateIndex<
	ParseCreateIndexTuple<B, Unique>
>

type FinalizeCreateIndex<T> = T extends [infer E extends SqlParserError<string>, infer R extends TokensList]
	? [E, R]
	: T extends [
				{
					readonly unique: infer U extends boolean
					readonly ifNotExists: infer I extends boolean
					readonly target: infer Q extends SqlQualifiedIdentifier
					readonly columns: infer Cols extends readonly string[]
				},
				infer Rest extends TokensList,
		  ]
		? [
				{
					readonly kind: "create_index_validated"
					readonly unique: U
					readonly ifNotExists: I
					readonly target: Q
					readonly columns: Cols
				},
				Rest,
			]
		: [SqlParserError<"Unable to parse CREATE INDEX">, EmptyTokenList]

type ParseCreateIndexTuple<B extends TokensList, Unique extends boolean> =
	ReadOptionalIfNotExists<B> extends [infer IfNotExists extends boolean, infer Rest0 extends TokensList]
		? ParseCreateIndexAfterIfNotExists<Rest0, Unique, IfNotExists>
		: never

type ParseCreateIndexAfterIfNotExists<Rest0 extends TokensList, Unique extends boolean, IfNotExists extends boolean> =
	ReadExpectedIdentifier<Rest0, "Expected index name in CREATE INDEX"> extends [
		infer IdxName,
		infer Rest1 extends TokensList,
	]
		? IdxName extends SqlParserError<string>
			? [IdxName, Rest1]
			: ParseCreateIndexAfterOn<Rest1, Unique, IfNotExists>
		: never

type ParseCreateIndexAfterOn<Rest1 extends TokensList, Unique extends boolean, IfNotExists extends boolean> =
	ReadExpectedToken<Rest1, "on", "Expected ON in CREATE INDEX"> extends [true, infer Rest2 extends TokensList]
		? ReadQualifiedIdentifierFromBuffer<Rest2> extends [
				infer Table extends SqlQualifiedIdentifier,
				infer Rest3 extends TokensList,
			]
			? ReadFirstParenGroup<Rest3> extends [infer Inner extends TokensList, infer Tail extends TokensList]
				? ParseCreateIndexAfterParen<Inner, Tail, Unique, IfNotExists, Table>
				: [SqlParserError<"Expected column list in CREATE INDEX">, Rest3]
			: [SqlParserError<"Expected table name after ON in CREATE INDEX">, Rest2]
		: ReadExpectedToken<Rest1, "on", "Expected ON in CREATE INDEX"> extends [
					infer E extends SqlParserError<string>,
					infer R extends TokensList,
			  ]
			? [E, R]
			: [SqlParserError<"Unable to parse CREATE INDEX">, Rest1]

type ParseCreateIndexAfterParen<
	Inner extends TokensList,
	Tail extends TokensList,
	Unique extends boolean,
	IfNotExists extends boolean,
	Table extends SqlQualifiedIdentifier,
> =
	ParseColumnListToTuple<Inner> extends [infer Cols extends readonly string[], infer _]
		? SkipStatement<Tail> extends [IgnorableStatement, infer RestFinal extends TokensList]
			? [
					{
						readonly unique: Unique
						readonly ifNotExists: IfNotExists
						readonly target: Table
						readonly columns: Cols
					},
					RestFinal,
				]
			: SkipStatement<Tail> extends [infer Err extends SqlParserError<string>, infer _R]
				? [Err, Tail]
				: [SqlParserError<"Unable to parse CREATE INDEX">, Tail]
		: [SqlParserError<"Unable to parse CREATE INDEX column list">, Tail]
