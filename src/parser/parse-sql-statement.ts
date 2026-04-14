import type { ParseAlterTable } from "./parse-alter-table.js"
import type { ParseCreateIndex } from "./parse-create-index.js"
import type { ParseCreateSchema } from "./parse-create-schema.js"
import type { ParseCreateTable } from "./parse-create-table.js"
import type { ParseDropSchema } from "./parse-drop-schema.js"
import type { ParseDropTable } from "./parse-drop-table.js"
import type { ParseInsertValues } from "./parse-insert-values.js"
import type { SkipStatement } from "./skip-statement.js"
import type { TokensList, EmptyTokenList, PeekToken, SkipToken, SqlParserError } from "./sql-tokens.js"

export type ParseSqlStatement<Tokens extends TokensList> =
	PeekToken<Tokens> extends infer Head extends string ? ParseSqlStatementByHead<Head, Tokens> : SkipStatement<Tokens>

type ParseSqlStatementByHead<Head extends string, Tokens extends TokensList> = Head extends ""
	? [SqlParserError<"Unknown sql statement">, Tokens]
	: Head extends "create"
		? ParseCreate<SkipToken<Tokens>>
		: Head extends "drop"
			? ParseDrop<SkipToken<Tokens>>
			: Head extends "alter"
				? ParseAlter<SkipToken<Tokens>>
				: Head extends "insert"
					? ParseInsert<SkipToken<Tokens>>
					: SkipStatement<Tokens>

// TODO:
/** Non-validated `INSERT` shapes (e.g. `INSERT … SELECT`) → skip from `insert` for ignorable. */
type InsertParseShapeMismatchAllowsSkip<Msg extends string> = Msg extends
	| "Expected VALUES after column list"
	| "Expected column list in INSERT"
	| "Expected INTO after INSERT"
	| "Expected table name in INSERT"
	? true
	: false

type ParseInsert<Tokens extends TokensList> =
	ParseInsertValues<Tokens> extends [infer Head, infer Rest extends TokensList]
		? Head extends { readonly kind: "insert_values" }
			? [Head, Rest]
			: Head extends SqlParserError<infer Msg extends string>
				? InsertParseShapeMismatchAllowsSkip<Msg> extends true
					? SkipStatement<Rest>
					: [Head, Rest]
				: [Head, Rest]
		: SkipStatement<EmptyTokenList>

type ParseCreate<Tokens extends TokensList> =
	PeekToken<Tokens> extends "table"
		? ParseCreateTable<SkipToken<Tokens>>
		: PeekToken<Tokens> extends "schema"
			? ParseCreateSchema<SkipToken<Tokens>>
			: PeekToken<Tokens> extends "unique"
				? ParseCreateUnique<SkipToken<Tokens>>
				: PeekToken<Tokens> extends "index"
					? ParseCreateIndex<SkipToken<Tokens>, false>
					: SkipStatement<Tokens>

type ParseCreateUnique<Tokens extends TokensList> =
	PeekToken<Tokens> extends "index" ? ParseCreateIndex<SkipToken<Tokens>, true> : SkipStatement<Tokens>

type ParseDrop<Tokens extends TokensList> =
	PeekToken<Tokens> extends "table"
		? ParseDropTable<SkipToken<Tokens>>
		: PeekToken<Tokens> extends "schema"
			? ParseDropSchema<SkipToken<Tokens>>
			: SkipStatement<Tokens>

type ParseAlter<Tokens extends TokensList> =
	PeekToken<Tokens> extends "table" ? SqlAlterWithMaybeSkipUnsupported<SkipToken<Tokens>> : SkipStatement<Tokens>

// TODO:
type SqlAlterWithMaybeSkipUnsupported<Tokens extends TokensList, Start extends TokensList = Tokens> =
	ParseAlterTable<Tokens> extends [infer Head, infer Rest extends TokensList]
		? Head extends { readonly kind: "alter_table" }
			? [Head, Rest]
			: Head extends SqlParserError<"Unsupported ALTER TABLE action">
				? SkipStatement<Start>
				: [Head, Rest]
		: [SqlParserError<"Unable to parse ALTER TABLE statement">, EmptyTokenList]

/**
 * Parses zero or more statements from `Tokens`. On **full** success returns `[readonly [...statements], rest]`
 * with `PeekToken<rest>` empty. On the first `SqlStatement` failure returns **`[error, buffer]`** only:
 * no tuple of prior successes, and `buffer` is the cursor at the **start** of the statement that failed.
 */
export type ParseSqlStatements<Tokens extends TokensList> = InternalParseStatements<Tokens, readonly []>

type InternalParseStatements<
	Tokens extends TokensList,
	Acc extends readonly unknown[],
	Start extends TokensList = Tokens,
> =
	PeekToken<Tokens> extends ""
		? [Acc, Tokens]
		: ParseSqlStatement<Tokens> extends [infer Head, infer Rest extends TokensList]
			? Head extends SqlParserError<string>
				? [Head, Start]
				: InternalParseStatements<Rest, readonly [...Acc, Head]>
			: [SqlParserError<"Unknown sql statement">, Start]

/**
 * Parses statements from `Tokens`, keeping every successful parse in order. On failure, returns
 * `[readonly [...parsed, error], buffer]` where `buffer` is `Tokens` at the **start** of the failing
 * statement (so later input after a bad statement is still visible). Use {@link ParseSqlStatements}
 * when you only need either a full success tuple or a single `[error, buffer]` with no partial list.
 */
export type ParseSqlStatementsRecovering<Tokens extends TokensList> = InternalParseSqlStatementsRecovering<
	Tokens,
	readonly []
>

type InternalParseSqlStatementsRecovering<
	Tokens extends TokensList,
	Acc extends readonly unknown[],
	Start extends TokensList = Tokens,
> =
	PeekToken<Tokens> extends ""
		? [Acc, Tokens]
		: ParseSqlStatement<Tokens> extends [infer Head, infer Rest extends TokensList]
			? Head extends SqlParserError<string>
				? [readonly [...Acc, Head], Start]
				: InternalParseSqlStatementsRecovering<Rest, readonly [...Acc, Head]>
			: [readonly [...Acc, SqlParserError<"Unknown sql statement">], Start]
