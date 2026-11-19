import type { JsqlDatabaseShape, JsqlDataShape, JsqlTypeShape } from "../core/jsql-shapes.ts"
import type {
	JsqlDbGetData,
	JsqlDbGetType,
	JsqlDbReplaceData,
	JsqlDbReplaceType,
	UnqualifiedSchema,
} from "../core/jsql-utils.ts"
import type { ParserMonad, PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { AsIdent, TokenEot, TokenIdent, TokenKey } from "../lexer/sql-lexer.ts"
import type { Errors, FormatError } from "../dbtyper-error.ts"
import type { SkipFailedStatement } from "./skip-statement.ts"

/**
 * The one parser of `DROP TABLE | VIEW | TYPE [IF EXISTS] [schema.]name [CASCADE | RESTRICT];` (CORE-19, review #146).
 * What differs between the kinds is data: the error row of {@link DropKinds} and the lookup in {@link DropTarget}.
 * Tables, views and types are never reached through different grammars, so a clause added here exists for all three.
 */
export type ParseDropTable<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> = ParseDrop<Tokens, Db, "table">
export type ParseDropType<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> = ParseDrop<Tokens, Db, "type">
export type ParseDropView<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> = ParseDrop<Tokens, Db, "view">

type DropKind = keyof DropKinds

/**
 * One row per kind. `ifExists`: no `exists` after `IF`; `name` / `afterDot`: no name; `plainTail` / `qualifiedTail`:
 * garbage after the name (the codes 1703 and 4002 are kept for the unqualified table and type names); `end`: garbage
 * after CASCADE / RESTRICT; `missing`: the name is unknown; `wrongKind`: the name is another kind of relation.
 */
type DropKinds = {
	table: {
		ifExists: FormatError<Errors["EXPECTED_EXISTS_AFTER_IF_IN_DROP_TABLE"], []>
		name: FormatError<Errors["EXPECTED_TABLE_NAME"], ["in DROP TABLE"]>
		afterDot: FormatError<Errors["EXPECTED_TABLE_NAME"], ["after `.` in DROP TABLE"]>
		plainTail: FormatError<Errors["EXPECTED_DOT_OR_END_OF_TABLE_NAME_IN_DROP_TABLE"], []>
		qualifiedTail: FormatError<Errors["EXPECTED_SEMICOLON"], ["qualified table name in DROP TABLE"]>
		end: FormatError<Errors["EXPECTED_SEMICOLON"], ["DROP TABLE"]>
		missing: FormatError<Errors["TABLE_DOES_NOT_EXIST_USE_IF_EXISTS"], []>
		wrongKind: FormatError<Errors["DROP_TABLE_TARGETS_A_VIEW_USE_DROP_VIEW"], []>
	}
	view: {
		ifExists: FormatError<Errors["EXPECTED_EXISTS_AFTER_IF_IN_DROP_VIEW"], []>
		name: FormatError<Errors["EXPECTED_VIEW_NAME_IN_DROP_VIEW"], []>
		afterDot: FormatError<Errors["EXPECTED_VIEW_NAME_IN_DROP_VIEW"], []>
		plainTail: FormatError<Errors["EXPECTED_SEMICOLON"], ["DROP VIEW"]>
		qualifiedTail: FormatError<Errors["EXPECTED_SEMICOLON"], ["DROP VIEW"]>
		end: FormatError<Errors["EXPECTED_SEMICOLON"], ["DROP VIEW"]>
		missing: FormatError<Errors["VIEW_DOES_NOT_EXIST_USE_IF_EXISTS"], []>
		wrongKind: FormatError<Errors["DROP_VIEW_TARGETS_A_TABLE_USE_DROP_TABLE"], []>
	}
	type: {
		ifExists: FormatError<Errors["EXPECTED_EXISTS_AFTER_IF_IN_DROP_TYPE"], []>
		name: FormatError<Errors["EXPECTED_TYPE_NAME"], ["in DROP TYPE"]>
		afterDot: FormatError<Errors["EXPECTED_TYPE_NAME"], ["after `.` in DROP TYPE"]>
		plainTail: FormatError<Errors["EXPECTED_DOT_OR_SEMICOLON_AFTER_TYPE_NAME_IN_DROP_TYPE"], []>
		qualifiedTail: FormatError<Errors["EXPECTED_SEMICOLON"], ["DROP TYPE"]>
		end: FormatError<Errors["EXPECTED_SEMICOLON"], ["DROP TYPE"]>
		missing: FormatError<Errors["TYPE_DOES_NOT_EXIST_USE_IF_EXISTS"], []>
		wrongKind: never
	}
}

type ParseDrop<Tokens extends ParserMonad, Db extends JsqlDatabaseShape, K extends DropKind> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends ParserMonad
			? PeekToken<A0> extends TokenKey<"exists">
				? ParseDropName<SkipToken<A0>, Db, K, true>
				: SkipFailedStatement<A0, Db, DropKinds[K]["ifExists"]>
			: never
		: ParseDropName<Tokens, Db, K, false>

type ParseDropName<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	K extends DropKind,
	IfExists extends boolean,
> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<infer A extends string>
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<".">
				? SkipToken<R1> extends infer R2 extends ParserMonad
					? AsIdent<PeekToken<R2>> extends TokenIdent<infer B extends string>
						? DropFinish<SkipToken<R2>, Db, K, IfExists, A, B, "qualifiedTail">
						: SkipFailedStatement<R2, Db, DropKinds[K]["afterDot"]>
					: never
				: DropFinish<
						R1,
						Db,
						K,
						IfExists,
						K extends "type" ? Db["defaultSchema"] : UnqualifiedSchema<Db, A>,
						A,
						"plainTail"
					>
			: never
		: SkipFailedStatement<Tokens, Db, DropKinds[K]["name"]>

/** `[CASCADE | RESTRICT] ;`, then the lookup. The tail is checked before the lookup, as a syntax error comes first. */
type DropFinish<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	K extends DropKind,
	IfExists extends boolean,
	Sch extends string,
	Name extends string,
	Tail extends "plainTail" | "qualifiedTail",
> =
	PeekToken<Tokens> extends TokenIdent<"cascade" | "restrict">
		? SkipToken<Tokens> extends infer R extends ParserMonad
			? PeekToken<R> extends TokenKey<";"> | TokenEot
				? DropTarget<R, Db, K, IfExists, Sch, Name>
				: SkipFailedStatement<R, Db, DropKinds[K]["end"]>
			: never
		: PeekToken<Tokens> extends TokenKey<";"> | TokenEot
			? DropTarget<Tokens, Db, K, IfExists, Sch, Name>
			: SkipFailedStatement<Tokens, Db, DropKinds[K][Tail]>

/** Looks the name up and removes it; `Tokens` is at the `;` or the end. */
type DropTarget<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	K extends DropKind,
	IfExists extends boolean,
	Sch extends string,
	Name extends string,
> = K extends "type"
	? JsqlDbGetType<Db, Sch, Name> extends JsqlTypeShape
		? JsqlDbReplaceType<Db, Sch, Name, null> extends infer NewDb extends JsqlDatabaseShape
			? [SkipToken<Tokens>, NewDb, null]
			: never
		: IfExists extends true
			? [SkipToken<Tokens>, Db, null]
			: SkipFailedStatement<Tokens, Db, DropKinds[K]["missing"]>
	: JsqlDbGetData<Db, Sch, Name> extends infer D
		? D extends JsqlDataShape<Exclude<K, "type">>
			? JsqlDbReplaceData<Db, Sch, Name, null> extends infer NewDb extends JsqlDatabaseShape
				? [SkipToken<Tokens>, NewDb, null]
				: never
			: [D] extends [null]
				? IfExists extends true
					? [SkipToken<Tokens>, Db, null]
					: SkipFailedStatement<Tokens, Db, DropKinds[K]["missing"]>
				: SkipFailedStatement<Tokens, Db, DropKinds[K]["wrongKind"]>
		: never
