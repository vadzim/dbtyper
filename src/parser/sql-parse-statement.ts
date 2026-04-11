import type { SqlAlterTable } from "./sql-alter-table.js"
import type { SqlCreateSchema } from "./sql-create-schema.js"
import type { SqlCreateTable } from "./sql-create-table.js"
import type { SqlDropSchema } from "./sql-drop-schema.js"
import type { SqlDropTable } from "./sql-drop-table.js"
import type { BufferLike, PeekToken, SqlParseError } from "./sql-tokens.js"

export type SqlStatement<Buffer extends BufferLike> =
	| SqlAlterTable<Buffer>
	| SqlCreateSchema<Buffer>
	| SqlCreateTable<Buffer>
	| SqlDropSchema<Buffer>
	| SqlDropTable<Buffer> extends infer Result
	? [Result] extends [never]
		? [SqlParseError<"Unknown sql statement">, Buffer]
		: Result extends [infer Result, infer Rest extends BufferLike]
			? [Result, Rest]
			: [SqlParseError<"Unknown sql statement">, Buffer]
	: [SqlParseError<"Unknown sql statement">, Buffer]

/**
 * Parses zero or more statements from `B`. On **full** success returns `[readonly [...statements], rest]`
 * with `PeekToken<rest>` empty. On the first `SqlStatement` failure returns **`[error, buffer]`** only:
 * no tuple of prior successes, and `buffer` is the cursor at the **start** of the statement that failed.
 */
export type SqlStatements<B extends BufferLike> = SqlStatementsRec<B, readonly []>

type SqlStatementsRec<B extends BufferLike, Acc extends readonly unknown[]> =
	PeekToken<B> extends ""
		? [Acc, B]
		: SqlStatement<B> extends [infer Head, infer Rest extends BufferLike]
			? Head extends SqlParseError<string>
				? [Head, B]
				: SqlStatementsRec<Rest, readonly [...Acc, Head]>
			: [SqlParseError<"Unknown sql statement">, B]

/**
 * Parses statements from `B`, keeping every successful parse in order. On failure, returns
 * `[readonly [...parsed, error], buffer]` where `buffer` is `B` at the **start** of the failing
 * statement (so later input after a bad statement is still visible). Use {@link SqlStatements}
 * when you only need either a full success tuple or a single `[error, buffer]` with no partial list.
 */
export type SqlStatementsRecovering<B extends BufferLike> = SqlStatementsRecoveringRec<B, readonly []>

type SqlStatementsRecoveringRec<B extends BufferLike, Acc extends readonly unknown[]> =
	PeekToken<B> extends ""
		? [Acc, B]
		: SqlStatement<B> extends [infer Head, infer Rest extends BufferLike]
			? Head extends SqlParseError<string>
				? [readonly [...Acc, Head], B]
				: SqlStatementsRecoveringRec<Rest, readonly [...Acc, Head]>
			: [readonly [...Acc, SqlParseError<"Unknown sql statement">], B]
