import type { JsqlDatabaseShape, JsqlTypeShape } from "../core/jsql-shapes.ts"
import type { JsqlDbGetType, JsqlDbReplaceType } from "../core/jsql-utils.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { DbtyperError, FormatError } from "../sql-parser-error.ts"
import type { SkipFailedQualifiedName } from "./skip-statement.ts"
import type { SkipFailedStatement } from "./skip-statement.ts"

export type ParseDropType<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends TokensList
			? PeekToken<A0> extends TokenKey<"exists">
				? SkipToken<A0> extends infer A1 extends TokensList
					? ParseDropTypeQualified<A1, Db, true>
					: never
				: SkipFailedStatement<A0, Db, FormatError<"EXPECTED_EXISTS_AFTER_IF_IN_DROP_TYPE", []>>
			: never
		: ParseDropTypeQualified<Tokens, Db, false>

/** After `schema.` in qualified `DROP TYPE schema.type`. */
type ParseDropQualifiedSecondIdent<AfterDot extends TokensList, A extends string> =
	PeekToken<AfterDot> extends infer T2
		? SkipToken<AfterDot> extends infer R2 extends TokensList
			? T2 extends TokenIdent<infer B extends string>
				? [R2, null, A, B]
				: SkipFailedQualifiedName<R2, FormatError<"EXPECTED_TYPE_NAME", ["after `.` in DROP TYPE"]>>
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
					: SkipFailedQualifiedName<
							R1,
							FormatError<"EXPECTED_DOT_OR_SEMICOLON_AFTER_TYPE_NAME_IN_DROP_TYPE", []>
						>
				: never
			: never

/** `[rest, null, schema, type]` on success; `[rest, error, never, never]` on parse failure. */
type ParseQualifiedTypeNameForDrop<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer NameTok
		? SkipToken<Tokens> extends infer AfterFirst extends TokensList
			? NameTok extends TokenIdent<infer A extends string>
				? ParseDropAfterFirstIdent<AfterFirst, Db, A>
				: SkipFailedQualifiedName<AfterFirst, FormatError<"EXPECTED_TYPE_NAME", ["in DROP TYPE"]>>
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
					: SkipFailedStatement<R, Db, FormatError<"TYPE_DOES_NOT_EXIST_USE_IF_EXISTS", []>>
			: [
					R,
					Db,
					E extends DbtyperError<-1 | keyof typeof import("../sql-parser-error.ts").errors, string>
						? E
						: FormatError<"INVALID_DROP_TYPE_PARSE", []>,
				]
		: never

type FinishDropStatement<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, Db, null]
		: SkipFailedStatement<Tokens, Db, FormatError<"EXPECTED_SEMICOLON", ["DROP TYPE"]>>
