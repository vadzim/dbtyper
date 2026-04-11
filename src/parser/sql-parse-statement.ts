import type { SqlAlterTable } from "./sql-alter-table.js"
import type { SqlCreateSchema } from "./sql-create-schema.js"
import type { SqlCreateTable } from "./sql-create-table.js"
import type { SqlDropSchema } from "./sql-drop-schema.js"
import type { SqlDropTable } from "./sql-drop-table.js"
import type { BufferLike, InitBuffer, PeekToken, SqlParseError } from "./sql-tokens.js"

export type SqlStatementLoose<Sql extends string> = SqlStatement<InitBuffer<Sql>>[0]

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

/** Parses zero or more statements from `B`. Returns `[tuple, rest]` where `tuple` is each successful parse in order; on failure the last element is `SqlParseError` and `rest` is the buffer from that parse. */
export type SqlStatementsRecovering<B extends BufferLike> = SqlStatementsRec<B, readonly []>

type SqlStatementsRec<B extends BufferLike, Acc extends readonly unknown[]> =
	PeekToken<B> extends ""
		? [Acc, B]
		: SqlStatement<B> extends [infer Head, infer Rest extends BufferLike]
			? Head extends SqlParseError<string>
				? [readonly [...Acc, Head], B]
				: SqlStatementsRec<Rest, readonly [...Acc, Head]>
			: [readonly [...Acc, SqlParseError<"Unknown sql statement">], B]
