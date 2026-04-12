import type { ParseAlterTable } from "./sql-alter-table.js"
import type { ParseCreateIndex } from "./sql-create-index.js"
import type { ParseCreateSchema } from "./sql-create-schema.js"
import type { ParseCreateTable } from "./sql-create-table.js"
import type { ParseDropSchema } from "./sql-drop-schema.js"
import type { ParseDropTable } from "./sql-drop-table.js"
import type { ParseInsertValues } from "./sql-insert-values.js"
import type { SkipStatement } from "./sql-skip-statement.js"
import type { TokensList, PeekToken, SkipToken, SqlParserError } from "./sql-tokens.js"

export type ParseSqlStatement<Tokens extends TokensList> =
	PeekToken<Tokens> extends ""
		? [SqlParserError<"Unknown sql statement">, Tokens]
		: PeekToken<Tokens> extends "create"
			? ParseCreate<SkipToken<Tokens>>
			: PeekToken<Tokens> extends "drop"
				? ParseDrop<SkipToken<Tokens>>
				: PeekToken<Tokens> extends "alter"
					? ParseAlter<SkipToken<Tokens>>
					: PeekToken<Tokens> extends "insert"
						? ParseInsert<SkipToken<Tokens>>
						: SkipStatement<Tokens>

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
					? SkipStatement<Tokens>
					: [Head, Rest]
				: [Head, Rest]
		: SkipStatement<Tokens>

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
	PeekToken<Tokens> extends "table" ? SqlAlterWithMaybeSkipUnsupported<Tokens> : SkipStatement<Tokens>

// TODO:
type SqlAlterWithMaybeSkipUnsupported<Tokens extends TokensList> =
	ParseAlterTable<SkipToken<Tokens>> extends [infer Head, infer Rest extends TokensList]
		? Head extends { readonly kind: "alter_table" }
			? [Head, Rest]
			: Head extends SqlParserError<"Unsupported ALTER TABLE action">
				? SkipStatement<Tokens>
				: [Head, Rest]
		: [SqlParserError<"Unable to parse ALTER TABLE statement">, Tokens]

/**
 * Parses zero or more statements from `B`. On **full** success returns `[readonly [...statements], rest]`
 * with `PeekToken<rest>` empty. On the first `SqlStatement` failure returns **`[error, buffer]`** only:
 * no tuple of prior successes, and `buffer` is the cursor at the **start** of the statement that failed.
 */
export type ParseSqlStatements<B extends TokensList> = InternalParseStatements<B, readonly []>

type InternalParseStatements<B extends TokensList, Acc extends readonly unknown[]> =
	PeekToken<B> extends ""
		? [Acc, B]
		: ParseSqlStatement<B> extends [infer Head, infer Rest extends TokensList]
			? Head extends SqlParserError<string>
				? [Head, B]
				: InternalParseStatements<Rest, readonly [...Acc, Head]>
			: [SqlParserError<"Unknown sql statement">, B]

/**
 * Parses statements from `B`, keeping every successful parse in order. On failure, returns
 * `[readonly [...parsed, error], buffer]` where `buffer` is `B` at the **start** of the failing
 * statement (so later input after a bad statement is still visible). Use {@link ParseSqlStatements}
 * when you only need either a full success tuple or a single `[error, buffer]` with no partial list.
 */
export type ParseSqlStatementsRecovering<B extends TokensList> = InternalParseSqlStatementsRecovering<B, readonly []>

type InternalParseSqlStatementsRecovering<B extends TokensList, Acc extends readonly unknown[]> =
	PeekToken<B> extends ""
		? [Acc, B]
		: ParseSqlStatement<B> extends [infer Head, infer Rest extends TokensList]
			? Head extends SqlParserError<string>
				? [readonly [...Acc, Head], B]
				: InternalParseSqlStatementsRecovering<Rest, readonly [...Acc, Head]>
			: [readonly [...Acc, SqlParserError<"Unknown sql statement">], B]
