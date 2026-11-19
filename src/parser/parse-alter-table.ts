import type { JsqlDatabaseShape, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { JsqlDbGetTable, UnqualifiedSchema, JsqlDbGetData } from "../core/jsql-utils.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { SkipFailedStatement } from "./skip-statement.ts"
import type { SkipBracketedUntil } from "./skip-statement.ts"
import type { ParseAlterAddColumn, ParseAlterDropColumn } from "./parse-alter-table-add-drop.ts"
import type { ParseAlterColumnAfterAlterKw } from "./parse-alter-table-alter-column.ts"
import type { ParseAlterRenameColumn } from "./parse-alter-table-rename.ts"

export type SkipUntilCommaOrSemi<Tokens extends ParserMonad> = SkipBracketedUntil<
	Tokens,
	TokenKey<","> | TokenKey<";"> | TokenEot
>

type ParseAlterAfterFirstIdent<AfterFirst extends ParserMonad, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<".">
		? SkipToken<AfterFirst> extends infer Rd1 extends ParserMonad
			? PeekToken<Rd1> extends TokenIdent<infer B extends string>
				? [SkipToken<Rd1>, null, A, B]
				: [Rd1, FormatError<Errors["EXPECTED_TABLE_NAME"], ["after `.` in ALTER TABLE"]>, null, null]
			: never
		: [AfterFirst, null, UnqualifiedSchema<Db, A>, A]

type ParseQualifiedAlterTableName<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenIdent<infer A extends string>
		? ParseAlterAfterFirstIdent<SkipToken<Tokens>, Db, A>
		: [SkipToken<Tokens>, FormatError<Errors["EXPECTED_TABLE_NAME"], ["in ALTER TABLE"]>, null, null]

export type FinishAlterStatement<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, Db, null]
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_SEMICOLON"], ["ALTER TABLE"]>>

export type ParseAlterActions<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? FinishAlterStatement<Tokens, Db>
		: PeekToken<Tokens> extends TokenKey<",">
			? ParseAlterActions<SkipToken<Tokens>, Db, Sch, Tab>
			: ParseAlterOneAction<Tokens, Db, Sch, Tab>

export type ParseAlterAfterOptionalColumnKw<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<"column"> ? [SkipToken<Tokens>, null] : [Tokens, null]

/** The rest of an action that changes no type is skipped up to `,` or `;`. */
export type ParseAlterSkipAction<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	SkipUntilCommaOrSemi<Tokens> extends [infer R extends ParserMonad, unknown]
		? ParseAlterActions<R, Db, Sch, Tab>
		: never

type ParseAlterOneAction<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	JsqlDbGetTable<Db, Sch, Tab> extends JsqlDataShape<"table">
		? PeekToken<Tokens> extends TokenKey<"add">
			? ParseAlterAddColumn<Tokens, Db, Sch, Tab>
			: PeekToken<Tokens> extends TokenKey<"drop">
				? ParseAlterDropColumn<Tokens, Db, Sch, Tab>
				: PeekToken<Tokens> extends TokenKey<"rename">
					? ParseAlterRenameColumn<Tokens, Db, Sch, Tab>
					: PeekToken<Tokens> extends TokenKey<"alter">
						? ParseAlterColumnAfterAlterKw<Tokens, Db, Sch, Tab>
						: PeekToken<Tokens> extends
									| TokenIdent<"enable" | "disable" | "force" | "owner">
									| TokenKey<"no">
							? // PGT-21: row level security and ownership change no type
								ParseAlterSkipAction<Tokens, Db, Sch, Tab>
							: SkipFailedStatement<Tokens, Db, FormatError<Errors["UNSUPPORTED_ALTER_TABLE_ACTION"], []>>
		: JsqlDbGetData<Db, Sch, Tab> extends null
			? [Tokens, Db, FormatError<Errors["TABLE_KEY_MISMATCH_IN_ALTER_TABLE"], []>]
			: SkipFailedStatement<Tokens, Db, FormatError<Errors["ALTER_TABLE_APPLIES_ONLY_TO_BASE_TABLES"], []>>

type ParseAlterAfterQualified<
	R extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Err,
	Sch extends string,
	Tab extends string,
> = Err extends null
	? JsqlDbGetTable<Db, Sch, Tab> extends object
		? Sch extends keyof Db["schemas"]
			? ParseAlterActions<R, Db, Sch & string, Tab & string>
			: never
		: SkipFailedStatement<R, Db, FormatError<Errors["TABLE_DOES_NOT_EXIST"], []>>
	: [R, Db, Err extends DbtyperErrorShape ? Err : FormatError<Errors["INVALID_ALTER_TABLE_NAME"], []>]

/** `ALTER TABLE IF EXISTS t …`: a no-op (skipped to `;`) when `t` does not exist. */
type ParseAlterIfExists<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	ParseQualifiedAlterTableName<Tokens, Db> extends [
		infer R extends ParserMonad,
		infer E,
		infer Sch extends string,
		infer Tab extends string,
	]
		? E extends null
			? JsqlDbGetTable<Db, Sch, Tab> extends object
				? ParseAlterAfterQualified<R, Db, E, Sch, Tab>
				: SkipBracketedUntil<R> extends [infer Rest extends ParserMonad, unknown]
					? [SkipToken<Rest>, Db, null]
					: never
			: ParseAlterAfterQualified<R, Db, E, Sch, Tab>
		: never

type ParseAlterAfterTableKeyword<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends ParserMonad
			? PeekToken<A0> extends TokenKey<"exists">
				? ParseAlterIfExists<SkipToken<A0>, Db>
				: SkipFailedStatement<A0, Db, FormatError<Errors["EXPECTED_EXISTS_AFTER_IF_IN_ALTER_TABLE"], []>>
			: never
		: ParseAlterPlain<Tokens, Db>

type ParseAlterPlain<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	ParseQualifiedAlterTableName<Tokens, Db> extends [
		infer R extends ParserMonad,
		infer E,
		infer Sch extends string,
		infer Tab extends string,
	]
		? ParseAlterAfterQualified<R, Db, E, Sch, Tab>
		: never

/**
 * `ALTER TABLE` for base tables: `ADD COLUMN`, `DROP COLUMN`, `RENAME COLUMN`, `ALTER COLUMN … TYPE`,
 * `SET NOT NULL` / `DROP NOT NULL`. `SET DEFAULT` / `DROP DEFAULT`, `ADD CONSTRAINT`, etc. are no-ops
 * (skipped until the next `,` or `;`).
 */
export type ParseAlterTable<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"table">
		? ParseAlterAfterTableKeyword<SkipToken<Tokens>, Db>
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_TABLE_AFTER_ALTER"], []>>
