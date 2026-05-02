import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"

/** After `schema.` — parse table name, then peek `(`. */
type ParseQualifiedSecondIdent<AfterDot extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterDot> extends infer Tok2
		? SkipToken<AfterDot> extends infer R2 extends TokensList
			? Tok2 extends TokenIdent<infer B extends string>
				? PeekToken<R2> extends TokenKey<"(">
					? [R2, null, A, B]
					: [R2, SqlParserError<"Expected `(` after qualified table name">, never, never]
				: [R2, SqlParserError<"Expected table name after `.` in qualified table name">, never, never]
			: never
		: never

/** After first ident `A` (unqualified or `A.`…). Unqualified names use {@link JsqlDatabaseShape["defaultSchema"]} as the schema key. */
type ParseQualifiedAfterFirstIdent<AfterFirst extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<"(">
		? [AfterFirst, null, Db["defaultSchema"], A]
		: PeekToken<AfterFirst> extends infer Tdot
			? SkipToken<AfterFirst> extends infer AfterDot extends TokensList
				? Tdot extends TokenKey<".">
					? ParseQualifiedSecondIdent<AfterDot, Db, A>
					: [AfterDot, SqlParserError<"Expected `.` or `(` after table name">, never, never]
				: never
			: never

/** `[rest, null, schema, table]` on success; `[rest, err, never, never]` on parse failure. */
export type ParseQualifiedTableName<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer NameTok
		? SkipToken<Tokens> extends infer AfterFirst extends TokensList
			? NameTok extends TokenIdent<infer A extends string>
				? ParseQualifiedAfterFirstIdent<AfterFirst, Db, A>
				: [AfterFirst, SqlParserError<"Expected table name in CREATE TABLE">, never, never]
			: never
		: never
