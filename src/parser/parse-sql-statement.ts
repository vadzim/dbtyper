import type { ParseAlterTable } from "./parse-alter-table.ts"
import type { ParseCreateIndex } from "./parse-create-index.ts"
import type { ParseCreateSchema } from "./parse-create-schema.ts"
import type { ParseCreateTable } from "./parse-create-table.ts"
import type { ParseDropSchema } from "./parse-drop-schema.ts"
import type { ParseDropTable } from "./parse-drop-table.ts"
import type { ParseInsertValues } from "./parse-insert-values.ts"
import type { SkipStatement } from "./skip-statement.ts"
import type { TokensList, PeekToken, SkipToken, SqlParserError, TokenEot, TokenKey } from "../../core/sql-tokens.ts"

export type ParseSqlStatements<Tokens extends TokensList> = InternalParseStatements<Tokens, []>

export type ParseSqlStatement<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenEot
		? [Tokens, SqlParserError<"Unknown sql statement">]
		: PeekToken<Tokens> extends TokenKey<"create">
			? ParseCreate<SkipToken<Tokens>>
			: PeekToken<Tokens> extends TokenKey<"drop">
				? ParseDrop<SkipToken<Tokens>>
				: PeekToken<Tokens> extends TokenKey<"alter">
					? ParseAlter<SkipToken<Tokens>>
					: PeekToken<Tokens> extends TokenKey<"insert">
						? ParseInsert<SkipToken<Tokens>>
						: SkipStatement<Tokens>

type InsertParseShapeMismatchAllowsSkip<Msg extends string> = Msg extends
	| "Expected VALUES after column list"
	| "Expected column list in INSERT"
	| "Expected INTO after INSERT"
	| "Expected table name in INSERT"
	? true
	: false

type ParseInsert<Tokens extends TokensList> =
	ParseInsertValues<Tokens> extends [infer Rest extends TokensList, infer Head]
		? Head extends { kind: "insert_values" }
			? [Rest, Head]
			: Head extends SqlParserError<infer Msg extends string>
				? InsertParseShapeMismatchAllowsSkip<Msg> extends true
					? SkipStatement<Rest>
					: [Rest, Head]
				: [Rest, Head]
		: never

type ParseCreate<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"table">
		? ParseCreateTable<SkipToken<Tokens>>
		: PeekToken<Tokens> extends TokenKey<"schema">
			? ParseCreateSchema<SkipToken<Tokens>>
			: PeekToken<Tokens> extends TokenKey<"unique">
				? ParseCreateUnique<SkipToken<Tokens>>
				: PeekToken<Tokens> extends TokenKey<"index">
					? ParseCreateIndex<SkipToken<Tokens>, false>
					: SkipStatement<Tokens>

type ParseCreateUnique<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"index"> ? ParseCreateIndex<SkipToken<Tokens>, true> : SkipStatement<Tokens>

type ParseDrop<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"table">
		? ParseDropTable<SkipToken<Tokens>>
		: PeekToken<Tokens> extends TokenKey<"schema">
			? ParseDropSchema<SkipToken<Tokens>>
			: SkipStatement<Tokens>

type ParseAlter<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"table">
		? SqlAlterWithMaybeSkipUnsupported<SkipToken<Tokens>>
		: SkipStatement<Tokens>

type SqlAlterWithMaybeSkipUnsupported<Tokens extends TokensList> =
	ParseAlterTable<Tokens> extends [infer Rest extends TokensList, infer Head]
		? Head extends { kind: "alter_table" }
			? [Rest, Head]
			: Head extends SqlParserError<"Unsupported ALTER TABLE action">
				? SkipStatement<Rest>
				: [Rest, Head]
		: never

type InternalParseStatements<Tokens extends TokensList, Acc extends unknown[]> =
	PeekToken<Tokens> extends TokenEot
		? [Tokens, Acc]
		: ParseSqlStatement<Tokens> extends [infer Rest extends TokensList, infer Head]
			? Head extends SqlParserError<string>
				? [Rest, Head]
				: InternalParseStatements<Rest, [...Acc, Head]>
			: never

export type ParseSqlStatementsRecovering<Tokens extends TokensList> = InternalParseSqlStatementsRecovering<Tokens, []>

type InternalParseSqlStatementsRecovering<Tokens extends TokensList, Acc extends unknown[]> =
	PeekToken<Tokens> extends TokenEot
		? [Tokens, Acc]
		: ParseSqlStatement<Tokens> extends [infer Rest extends TokensList, infer Head]
			? Head extends SqlParserError<string>
				? [Rest, [...Acc, Head]]
				: InternalParseSqlStatementsRecovering<Rest, [...Acc, Head]> extends [
							infer Rest2 extends TokensList,
							infer Result,
					  ]
					? [Rest2, Result]
					: never
			: never
