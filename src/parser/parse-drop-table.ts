import type { JsqlDatabaseShape, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { JsqlDbGetTable, JsqlDbGetData, JsqlDbReplaceData } from "../core/jsql-utils.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"

export type ParseDropTable<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends TokensList
			? PeekToken<A0> extends TokenKey<"exists">
				? SkipToken<A0> extends infer A1 extends TokensList
					? ParseDropTableQualified<A1, Db, true>
					: never
				: [A0, Db, SqlParserError<"Expected `exists` after `IF` in DROP TABLE">]
			: never
		: ParseDropTableQualified<Tokens, Db, false>

/** After `schema.` in qualified `DROP TABLE schema.table`. */
type ParseDropQualifiedSecondIdent<AfterDot extends TokensList, A extends string> =
	PeekToken<AfterDot> extends TokenIdent<infer B extends string>
		? SkipToken<AfterDot> extends infer R2 extends TokensList
			? PeekToken<R2> extends TokenKey<";"> | TokenEot
				? [SkipToken<R2>, null, A, B]
				: [R2, SqlParserError<"Expected `;` after qualified table name in DROP TABLE">, never, never]
			: never
		: never

/** After first identifier (table or schema). */
type ParseDropAfterFirstIdent<AfterFirst extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<";"> | TokenEot
		? [SkipToken<AfterFirst>, null, Db["defaultSchema"], A]
		: PeekToken<AfterFirst> extends TokenKey<".">
			? ParseDropQualifiedSecondIdent<SkipToken<AfterFirst>, A>
			: [AfterFirst, SqlParserError<"Expected `.` or end of table name in DROP TABLE">, never, never]

/** `[rest, null, schema, table]` on success; `[rest, error, never, never]` on parse failure. */
type ParseQualifiedTableNameForDrop<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer NameTok
		? SkipToken<Tokens> extends infer AfterFirst extends TokensList
			? NameTok extends TokenIdent<infer A extends string>
				? ParseDropAfterFirstIdent<AfterFirst, Db, A>
				: [AfterFirst, SqlParserError<"Expected table name in DROP TABLE">, never, never]
			: never
		: never

type ParseDropTableQualified<Tokens extends TokensList, Db extends JsqlDatabaseShape, IfExists extends boolean> =
	ParseQualifiedTableNameForDrop<Tokens, Db> extends [
		infer R extends TokensList,
		infer E,
		infer Sch extends string,
		infer Tab extends string,
	]
		? E extends null
			? IfExists extends true
				? JsqlDbGetTable<Db, Sch, Tab> extends JsqlDataShape<"table">
					? JsqlDbReplaceData<Db, Sch, Tab, null> extends infer NewDb extends JsqlDatabaseShape
						? FinishDropStatement<R, NewDb>
						: never
					: FinishDropStatement<R, Db>
				: JsqlDbGetTable<Db, Sch, Tab> extends JsqlDataShape<"table">
					? JsqlDbReplaceData<Db, Sch, Tab, null> extends infer NewDb extends JsqlDatabaseShape
						? FinishDropStatement<R, NewDb>
						: never
					: JsqlDbGetData<Db, Sch, Tab> extends null
						? [R, Db, SqlParserError<"Table does not exist; use IF EXISTS">]
						: [R, Db, SqlParserError<"DROP TABLE targets a view; use DROP VIEW">]
			: [R, Db, E extends SqlParserError<string> ? E : SqlParserError<"Invalid DROP TABLE parse">]
		: never

type FinishDropStatement<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, Db, null]
		: [SkipToken<Tokens>, Db, SqlParserError<"Expected `;` after DROP TABLE">]
