import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlDataShape } from "../core/jsql-shapes.ts"
import type {
	JsqlDbGetSchema,
	JsqlDbGetTable,
	JsqlDbGetData,
	JsqlSchemaGetData,
	JsqlSchemaGetTable,
	JsqlDbReplaceData,
} from "../core/jsql-utils.ts"
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

type SetEntry<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string> = JsqlSchemaGetData<
	JsqlDbGetSchema<Db, Sch>,
	Tab
>

/** `DROP TABLE` may only remove a relation whose `kind` is `"table"`. */
type IsDroppableTableEntry<E> = E extends JsqlDataShape ? (E["kind"] extends "table" ? true : false) : false

/** After `schema.` in qualified `DROP TABLE schema.table`. */
type ParseDropQualifiedSecondIdent<AfterDot extends TokensList, A extends string> =
	PeekToken<AfterDot> extends infer T2
		? SkipToken<AfterDot> extends infer R2 extends TokensList
			? T2 extends TokenIdent<infer B extends string>
				? PeekToken<R2> extends infer T3
					? SkipToken<R2> extends infer R3 extends TokensList
						? T3 extends TokenKey<";"> | TokenEot
							? [R3, null, A, B]
							: [
									R3,
									SqlParserError<"Expected `;` after qualified table name in DROP TABLE">,
									never,
									never,
								]
						: never
					: never
				: [R2, SqlParserError<"Expected table name after `.` in DROP TABLE">, never, never]
			: never
		: never

/** After first identifier (table or schema). */
type ParseDropAfterFirstIdent<AfterFirst extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends infer T1
		? SkipToken<AfterFirst> extends infer R1 extends TokensList
			? T1 extends TokenKey<";"> | TokenEot
				? [R1, null, Db["defaultSchema"], A]
				: T1 extends TokenKey<".">
					? ParseDropQualifiedSecondIdent<R1, A>
					: [R1, SqlParserError<"Expected `.` or end of table name in DROP TABLE">, never, never]
			: never
		: never

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
