import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlTypeShape } from "../core/jsql-shapes.ts"
import type { JsqlDbGetSchema, JsqlDbGetType, JsqlDbReplaceType } from "../core/jsql-utils.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"

export type ParseDropType<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends TokensList
			? PeekToken<A0> extends TokenKey<"exists">
				? SkipToken<A0> extends infer A1 extends TokensList
					? ParseDropTypeQualified<A1, Db, true>
					: never
				: [A0, Db, SqlParserError<"Expected `exists` after `IF` in DROP TYPE">]
			: never
		: ParseDropTypeQualified<Tokens, Db, false>

/** After `schema.` in qualified `DROP TYPE schema.type`. */
type ParseDropQualifiedSecondIdent<AfterDot extends TokensList, A extends string> =
	PeekToken<AfterDot> extends infer T2
		? SkipToken<AfterDot> extends infer R2 extends TokensList
			? T2 extends TokenIdent<infer B extends string>
				? [R2, null, A, B]
				: [R2, SqlParserError<"Expected type name after `.` in DROP TYPE">, never, never]
			: never
		: never

/** After first identifier (type or schema). */
type ParseDropAfterFirstIdent<AfterFirst extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<";"> | TokenEot
		? [AfterFirst, null, Db["defaultSchema"], A]
		: PeekToken<AfterFirst> extends infer T1
			? SkipToken<AfterFirst> extends infer R1 extends TokensList
				? T1 extends TokenKey<".">
					? ParseDropQualifiedSecondIdent<R1, A>
					: [R1, SqlParserError<"Expected `.` or `;` after type name in DROP TYPE">, never, never]
				: never
			: never

/** `[rest, null, schema, type]` on success; `[rest, error, never, never]` on parse failure. */
type ParseQualifiedTypeNameForDrop<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer NameTok
		? SkipToken<Tokens> extends infer AfterFirst extends TokensList
			? NameTok extends TokenIdent<infer A extends string>
				? ParseDropAfterFirstIdent<AfterFirst, Db, A>
				: [AfterFirst, SqlParserError<"Expected type name in DROP TYPE">, never, never]
			: never
		: never

type ParseDropTypeQualified<Tokens extends TokensList, Db extends JsqlDatabaseShape, IfExists extends boolean> =
	ParseQualifiedTypeNameForDrop<Tokens, Db> extends [
		infer R extends TokensList,
		infer E,
		infer Sch extends string,
		infer Typ extends string,
	]
		? E extends null
			? IfExists extends true
				? JsqlDbGetType<Db, Sch, Typ> extends JsqlTypeShape
					? JsqlDbReplaceType<Db, Sch, Typ, null> extends infer NewDb extends JsqlDatabaseShape
						? FinishDropStatement<R, NewDb>
						: never
					: FinishDropStatement<R, Db>
				: JsqlDbGetType<Db, Sch, Typ> extends JsqlTypeShape
					? JsqlDbReplaceType<Db, Sch, Typ, null> extends infer NewDb extends JsqlDatabaseShape
						? FinishDropStatement<R, NewDb>
						: never
					: [R, Db, SqlParserError<"Type does not exist; use IF EXISTS">]
			: [R, Db, E extends SqlParserError<string> ? E : SqlParserError<"Invalid DROP TYPE parse">]
		: never

type FinishDropStatement<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, Db, null]
		: [SkipToken<Tokens>, Db, SqlParserError<"Expected `;` after DROP TYPE">]
