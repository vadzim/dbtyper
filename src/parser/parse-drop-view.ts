import type { JsqlDatabaseShape, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { JsqlDbGetData, JsqlDbGetView, JsqlDbReplaceData, UnqualifiedSchema } from "../core/jsql-utils.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot, TokenIdent, TokenKey, AsIdent } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors } from "../dbtyper-error.ts"
import type { SkipFailedStatement } from "./skip-statement.ts"

/** `DROP VIEW [IF EXISTS] [schema.]name [CASCADE | RESTRICT];` (CORE-19). */
export type ParseDropView<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends ParserMonad
			? PeekToken<A0> extends TokenKey<"exists">
				? ParseDropViewName<SkipToken<A0>, Db, true>
				: SkipFailedStatement<A0, Db, FormatError<Errors["EXPECTED_EXISTS_AFTER_IF_IN_DROP_VIEW"], []>>
			: never
		: ParseDropViewName<Tokens, Db, false>

type ParseDropViewName<Tokens extends ParserMonad, Db extends JsqlDatabaseShape, IfExists extends boolean> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<infer A extends string>
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<".">
				? SkipToken<R1> extends infer R2 extends ParserMonad
					? AsIdent<PeekToken<R2>> extends TokenIdent<infer B extends string>
						? DropViewTarget<SkipToken<R2>, Db, IfExists, A, B>
						: SkipFailedStatement<R2, Db, FormatError<Errors["EXPECTED_VIEW_NAME_IN_DROP_VIEW"], []>>
					: never
				: DropViewTarget<R1, Db, IfExists, UnqualifiedSchema<Db, A>, A>
			: never
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_VIEW_NAME_IN_DROP_VIEW"], []>>

type DropViewTarget<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	IfExists extends boolean,
	Sch extends string,
	Name extends string,
> =
	JsqlDbGetView<Db, Sch, Name> extends JsqlDataShape<"view">
		? JsqlDbReplaceData<Db, Sch, Name, null> extends infer NewDb extends JsqlDatabaseShape
			? FinishDropView<Tokens, NewDb>
			: never
		: JsqlDbGetData<Db, Sch, Name> extends null
			? IfExists extends true
				? FinishDropView<Tokens, Db>
				: SkipFailedStatement<Tokens, Db, FormatError<Errors["VIEW_DOES_NOT_EXIST_USE_IF_EXISTS"], []>>
			: SkipFailedStatement<Tokens, Db, FormatError<Errors["DROP_VIEW_TARGETS_A_TABLE_USE_DROP_TABLE"], []>>

type FinishDropView<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenIdent<"cascade" | "restrict">
		? FinishDropView<SkipToken<Tokens>, Db>
		: PeekToken<Tokens> extends TokenKey<";"> | TokenEot
			? [SkipToken<Tokens>, Db, null]
			: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_SEMICOLON"], ["DROP VIEW"]>>
