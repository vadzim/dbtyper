import type { SqlAlterTable } from "./sql-alter-table.js"
import type { SqlCreateSchema } from "./sql-create-schema.js"
import type { SqlCreateTable } from "./sql-create-table.js"
import type { SqlDropSchema } from "./sql-drop-schema.js"
import type { SqlDropTable } from "./sql-drop-table.js"
import type { TokensList, PeekToken, SkipToken, SqlParseError } from "./sql-tokens.js"

export type SqlStatement<Buffer extends TokensList> =
	PeekToken<Buffer> extends ""
		? [SqlParseError<"Unknown sql statement">, Buffer]
		: PeekToken<Buffer> extends "create"
			? SqlStatementAfterCreate<SkipToken<Buffer>, Buffer>
			: PeekToken<Buffer> extends "drop"
				? SqlStatementAfterDrop<SkipToken<Buffer>, Buffer>
				: PeekToken<Buffer> extends "alter"
					? SqlStatementAfterAlter<SkipToken<Buffer>, Buffer>
					: [SqlParseError<"Unknown sql statement">, Buffer]

type SqlStatementAfterCreate<AfterCreate extends TokensList, Orig extends TokensList> =
	PeekToken<AfterCreate> extends "table"
		? SqlCreateTable<SkipToken<AfterCreate>>
		: PeekToken<AfterCreate> extends "schema"
			? SqlCreateSchema<SkipToken<AfterCreate>>
			: [SqlParseError<"Unknown sql statement">, Orig]

type SqlStatementAfterDrop<AfterDrop extends TokensList, Orig extends TokensList> =
	PeekToken<AfterDrop> extends "table"
		? SqlDropTable<SkipToken<AfterDrop>>
		: PeekToken<AfterDrop> extends "schema"
			? SqlDropSchema<SkipToken<AfterDrop>>
			: [SqlParseError<"Unknown sql statement">, Orig]

/** Second token after `alter` selects the statement kind; extend with more branches when new ALTER variants exist. */
type SqlStatementAfterAlter<AfterAlter extends TokensList, Orig extends TokensList> =
	PeekToken<AfterAlter> extends "table"
		? SqlAlterTable<SkipToken<AfterAlter>>
		: [SqlParseError<"Unknown sql statement">, Orig]

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
export type SqlStatementsRecovering<B extends TokensList> = SqlStatementsRecoveringRec<B, readonly []>

type SqlStatementsRecoveringRec<B extends TokensList, Acc extends readonly unknown[]> =
	PeekToken<B> extends ""
		? [Acc, B]
		: SqlStatement<B> extends [infer Head, infer Rest extends TokensList]
			? Head extends SqlParseError<string>
				? [readonly [...Acc, Head], B]
				: SqlStatementsRecoveringRec<Rest, readonly [...Acc, Head]>
			: [readonly [...Acc, SqlParseError<"Unknown sql statement">], B]
