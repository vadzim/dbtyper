import type { JsqlDatabaseShape } from "../../core/jsql-shapes.ts"
import type { PeekToken, ReadToken, SqlParserError, TokenIdent, TokenKey, TokensList } from "../../core/sql-tokens.ts"

/** After `schema.` — one `ReadToken` for the table name, then peek `(`. */
type ParseQualifiedSecondIdent<AfterDot extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	ReadToken<AfterDot> extends [infer R2 extends TokensList, infer Tok2]
		? Tok2 extends TokenIdent<infer B extends string>
			? PeekToken<R2> extends TokenKey<"(">
				? [R2, null, A, B]
				: [R2, SqlParserError<"Expected `(` after qualified table name">, never, never]
			: [R2, SqlParserError<"Expected table name after `.` in qualified table name">, never, never]
		: never

/** After first ident `A` (unqualified or `A.`…). Unqualified names use {@link JsqlDatabaseShape["defaultSchema"]} as the schema key. */
type ParseQualifiedAfterFirstIdent<AfterFirst extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<"(">
		? [AfterFirst, null, Db["defaultSchema"], A]
		: ReadToken<AfterFirst> extends [infer AfterDot extends TokensList, infer Tdot]
			? Tdot extends TokenKey<".">
				? ParseQualifiedSecondIdent<AfterDot, Db, A>
				: [AfterDot, SqlParserError<"Expected `.` or `(` after table name">, never, never]
			: never

/** `[rest, null, schema, table]` on success; `[rest, err, never, never]` on parse failure. */
export type ParseQualifiedTableName<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	ReadToken<Tokens> extends [infer AfterFirst extends TokensList, infer NameTok]
		? NameTok extends TokenIdent<infer A extends string>
			? ParseQualifiedAfterFirstIdent<AfterFirst, Db, A>
			: [AfterFirst, SqlParserError<"Expected table name in CREATE TABLE">, never, never]
		: never
