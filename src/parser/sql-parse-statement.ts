import type { ParseAlterTable } from "./sql-alter-table.js"
import type { ParseCreateIndex } from "./sql-create-index.js"
import type { ParseCreateSchema } from "./sql-create-schema.js"
import type { ParseCreateTable } from "./sql-create-table.js"
import type { ParseDropSchema } from "./sql-drop-schema.js"
import type { ParseDropTable } from "./sql-drop-table.js"
import type { ParseInsertValues } from "./sql-insert-values.js"
import type { SkipStatementFromBuffer } from "./sql-skip-statement.js"
import type { TokensList, PeekToken, SkipToken, SqlParserError } from "./sql-tokens.js"

export type SqlStatement<Tokens extends TokensList> =
	PeekToken<Tokens> extends ""
		? [SqlParserError<"Unknown sql statement">, Tokens]
		: PeekToken<Tokens> extends "create"
			? ParseCreate<SkipToken<Tokens>, Tokens>
			: PeekToken<Tokens> extends "drop"
				? ParseDrop<SkipToken<Tokens>, Tokens>
				: PeekToken<Tokens> extends "alter"
					? ParseAlter<SkipToken<Tokens>, Tokens>
					: PeekToken<Tokens> extends "insert"
						? ParseInsert<SkipToken<Tokens>, Tokens>
						: SkipStatementFromBuffer<Tokens>

/** Non-validated `INSERT` shapes (e.g. `INSERT … SELECT`) → skip from `insert` for ignorable. */
type InsertParseShapeMismatchAllowsSkip<Msg extends string> = Msg extends
	| "Expected VALUES after column list"
	| "Expected column list in INSERT"
	| "Expected INTO after INSERT"
	| "Expected table name in INSERT"
	? true
	: false

type ParseInsert<Tokens extends TokensList, Orig extends TokensList> =
	ParseInsertValues<Tokens> extends [infer Head, infer Rest extends TokensList]
		? Head extends { readonly kind: "insert_values_validated" }
			? [Head, Rest]
			: Head extends SqlParserError<infer Msg extends string>
				? InsertParseShapeMismatchAllowsSkip<Msg> extends true
					? SkipStatementFromBuffer<Orig>
					: [Head, Rest]
				: [Head, Rest]
		: SkipStatementFromBuffer<Orig>

type ParseCreate<Tokens extends TokensList, Orig extends TokensList> =
	PeekToken<Tokens> extends "table"
		? ParseCreateTable<SkipToken<Tokens>>
		: PeekToken<Tokens> extends "schema"
			? ParseCreateSchema<SkipToken<Tokens>>
			: PeekToken<Tokens> extends "unique"
				? SqlStatementAfterCreateUniqueIndex<SkipToken<Tokens>, Orig>
				: PeekToken<Tokens> extends "index"
					? ParseCreateIndex<SkipToken<Tokens>, false>
					: SkipStatementFromBuffer<Orig>

type SqlStatementAfterCreateUniqueIndex<AfterUnique extends TokensList, Orig extends TokensList> =
	PeekToken<AfterUnique> extends "index"
		? ParseCreateIndex<SkipToken<AfterUnique>, true>
		: SkipStatementFromBuffer<Orig>

type ParseDrop<AfterDrop extends TokensList, Orig extends TokensList> =
	PeekToken<AfterDrop> extends "table"
		? ParseDropTable<SkipToken<AfterDrop>>
		: PeekToken<AfterDrop> extends "schema"
			? ParseDropSchema<SkipToken<AfterDrop>>
			: SkipStatementFromBuffer<Orig>

type ParseAlter<AfterAlter extends TokensList, Orig extends TokensList> =
	PeekToken<AfterAlter> extends "table"
		? SqlAlterWithMaybeSkipUnsupported<AfterAlter, Orig>
		: SkipStatementFromBuffer<Orig>

type SqlAlterWithMaybeSkipUnsupported<AfterAlter extends TokensList, Orig extends TokensList> =
	ParseAlterTable<SkipToken<AfterAlter>> extends [infer Head, infer Rest extends TokensList]
		? Head extends { readonly kind: "alter_table" }
			? [Head, Rest]
			: Head extends { readonly __sql_parser_error__: "Unsupported ALTER TABLE action" }
				? SkipStatementFromBuffer<Orig>
				: [Head, Rest]
		: [SqlParserError<"Unable to parse ALTER TABLE statement">, Orig]

/**
 * Parses zero or more statements from `B`. On **full** success returns `[readonly [...statements], rest]`
 * with `PeekToken<rest>` empty. On the first `SqlStatement` failure returns **`[error, buffer]`** only:
 * no tuple of prior successes, and `buffer` is the cursor at the **start** of the statement that failed.
 */
export type SqlStatements<B extends TokensList> = SqlStatementsRec<B, readonly []>

type SqlStatementsRec<B extends TokensList, Acc extends readonly unknown[]> =
	PeekToken<B> extends ""
		? [Acc, B]
		: SqlStatement<B> extends [infer Head, infer Rest extends TokensList]
			? Head extends SqlParserError<string>
				? [Head, B]
				: SqlStatementsRec<Rest, readonly [...Acc, Head]>
			: [SqlParserError<"Unknown sql statement">, B]

/**
 * Parses statements from `B`, keeping every successful parse in order. On failure, returns
 * `[readonly [...parsed, error], buffer]` where `buffer` is `B` at the **start** of the failing
 * statement (so later input after a bad statement is still visible). Use {@link SqlStatements}
 * when you only need either a full success tuple or a single `[error, buffer]` with no partial list.
 */
export type SqlStatementsRecovering<B extends TokensList> = SqlStatementsRecoveringRec<B, readonly []>

type SqlStatementsRecoveringRec<B extends TokensList, Acc extends readonly unknown[]> =
	PeekToken<B> extends ""
		? [Acc, B]
		: SqlStatement<B> extends [infer Head, infer Rest extends TokensList]
			? Head extends SqlParserError<string>
				? [readonly [...Acc, Head], B]
				: SqlStatementsRecoveringRec<Rest, readonly [...Acc, Head]>
			: [readonly [...Acc, SqlParserError<"Unknown sql statement">], B]
