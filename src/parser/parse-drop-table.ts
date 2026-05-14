import type { JsqlDatabaseShape, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { JsqlDbGetTable, JsqlDbGetData, JsqlDbReplaceData } from "../core/jsql-utils.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { SkipFailedQualifiedName } from "./skip-statement.ts"
import type { SkipFailedStatement } from "./skip-statement.ts"

export type ParseDropTable<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends ParserMonad
			? PeekToken<A0> extends TokenKey<"exists">
				? ParseDropTableQualified<SkipToken<A0>, Db, true>
				: SkipFailedStatement<A0, Db, FormatError<Errors["EXPECTED_EXISTS_AFTER_IF_IN_DROP_TABLE"], []>>
			: never
		: ParseDropTableQualified<Tokens, Db, false>

/** After `schema.` in qualified `DROP TABLE schema.table`. */
type ParseDropQualifiedSecondIdent<AfterDot extends ParserMonad, A extends string> =
	PeekToken<AfterDot> extends TokenIdent<infer B extends string>
		? SkipToken<AfterDot> extends infer R2 extends ParserMonad
			? PeekToken<R2> extends TokenKey<";"> | TokenEot
				? [SkipToken<R2>, null, A, B]
				: SkipFailedQualifiedName<
						R2,
						FormatError<Errors["EXPECTED_SEMICOLON"], ["qualified table name in DROP TABLE"]>
					>
			: never
		: never

/** After first identifier (table or schema). */
type ParseDropAfterFirstIdent<AfterFirst extends ParserMonad, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<";"> | TokenEot
		? [SkipToken<AfterFirst>, null, Db["defaultSchema"], A]
		: PeekToken<AfterFirst> extends TokenKey<".">
			? ParseDropQualifiedSecondIdent<SkipToken<AfterFirst>, A>
			: SkipFailedQualifiedName<
					AfterFirst,
					FormatError<Errors["EXPECTED_DOT_OR_END_OF_TABLE_NAME_IN_DROP_TABLE"], []>
				>

/** `[rest, null, schema, table]` on success; `[rest, error, never, never]` on parse failure. */
type ParseQualifiedTableNameForDrop<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer NameTok
		? SkipToken<Tokens> extends infer AfterFirst extends ParserMonad
			? NameTok extends TokenIdent<infer A extends string>
				? ParseDropAfterFirstIdent<AfterFirst, Db, A>
				: SkipFailedQualifiedName<AfterFirst, FormatError<Errors["EXPECTED_TABLE_NAME"], ["in DROP TABLE"]>>
			: never
		: never

type ParseDropTableQualified<Tokens extends ParserMonad, Db extends JsqlDatabaseShape, IfExists extends boolean> =
	ParseQualifiedTableNameForDrop<Tokens, Db> extends [
		infer R extends ParserMonad,
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
						? SkipFailedStatement<R, Db, FormatError<Errors["TABLE_DOES_NOT_EXIST_USE_IF_EXISTS"], []>>
						: SkipFailedStatement<R, Db, FormatError<Errors["DROP_TABLE_TARGETS_A_VIEW_USE_DROP_VIEW"], []>>
			: [R, Db, E extends DbtyperErrorShape ? E : FormatError<Errors["INVALID_DROP_TABLE_PARSE"], []>]
		: never

type FinishDropStatement<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, Db, null]
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_SEMICOLON"], ["DROP TABLE"]>>
