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
import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { DbDialectOnlyError } from "../core/dialect.ts"
import type { SkipFailedStatement } from "./skip-statement.ts"

/**
 * The one parser of `DROP TABLE | VIEW | TYPE | DOMAIN [IF EXISTS] [schema.]name [, …] [CASCADE | RESTRICT];` (CORE-19,
 * review #146, #175).
 * What differs between the kinds is data: the error row of {@link DropKinds} and the lookup in {@link DropTarget}.
 * Tables, views, types and domains are never reached through different grammars, so a clause added here exists for all of them.
 */
export type ParseDropTable<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> = ParseDrop<Tokens, Db, "table">
export type ParseDropType<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> = ParseDrop<Tokens, Db, "type">
export type ParseDropView<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> = ParseDrop<Tokens, Db, "view">
/** `DROP DOMAIN` (#158): removes a domain of CREATE DOMAIN (PGT-22). */
export type ParseDropDomain<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> = ParseDrop<Tokens, Db, "domain">

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
	domain: {
		ifExists: FormatError<Errors["EXPECTED_EXISTS_AFTER_IF_IN_DROP_TYPE"], []>
		name: FormatError<Errors["EXPECTED_TYPE_NAME"], ["in DROP DOMAIN"]>
		afterDot: FormatError<Errors["EXPECTED_TYPE_NAME"], ["after `.` in DROP DOMAIN"]>
		plainTail: FormatError<Errors["EXPECTED_SEMICOLON"], ["DROP DOMAIN"]>
		qualifiedTail: FormatError<Errors["EXPECTED_SEMICOLON"], ["DROP DOMAIN"]>
		end: FormatError<Errors["EXPECTED_SEMICOLON"], ["DROP DOMAIN"]>
		missing: FormatError<Errors["TYPE_DOES_NOT_EXIST_USE_IF_EXISTS"], []>
		wrongKind: FormatError<Errors["TYPE_IS_NOT_A_DOMAIN"], []>
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
				? ParseDropName<SkipToken<A0>, Db, K, true, readonly []>
				: SkipFailedStatement<A0, Db, DropKinds[K]["ifExists"]>
			: never
		: ParseDropName<Tokens, Db, K, false, readonly []>

/** One `[schema, name]` of the name list. */
type DropName = readonly [string, string]

type ParseDropName<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	K extends DropKind,
	IfExists extends boolean,
	Acc extends readonly DropName[],
> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<infer A extends string>
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<".">
				? SkipToken<R1> extends infer R2 extends ParserMonad
					? AsIdent<PeekToken<R2>> extends TokenIdent<infer B extends string>
						? DropAfterName<
								SkipToken<R2>,
								Db,
								K,
								IfExists,
								readonly [...Acc, readonly [A, B]],
								"qualifiedTail"
							>
						: SkipFailedStatement<R2, Db, DropKinds[K]["afterDot"]>
					: never
				: DropAfterName<
						R1,
						Db,
						K,
						IfExists,
						readonly [
							...Acc,
							readonly [K extends "type" | "domain" ? Db["defaultSchema"] : UnqualifiedSchema<Db, A>, A],
						],
						"plainTail"
					>
			: never
		: SkipFailedStatement<Tokens, Db, DropKinds[K]["name"]>

/**
 * `, name …` (PostgreSQL: a name list), `[CASCADE | RESTRICT] ;` (PostgreSQL, SCHEMA-29), then the lookups. The tail
 * is checked before the lookups, as a syntax error comes first. Neither the list nor the keywords exist in SQLite.
 */
type DropAfterName<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	K extends DropKind,
	IfExists extends boolean,
	Names extends readonly DropName[],
	Tail extends "plainTail" | "qualifiedTail",
> =
	PeekToken<Tokens> extends TokenKey<",">
		? DbDialectOnlyError<Db, "pg-drop-list"> extends infer OnlyErr extends DbtyperErrorShape
			? SkipFailedStatement<Tokens, Db, OnlyErr>
			: ParseDropName<SkipToken<Tokens>, Db, K, IfExists, Names>
		: PeekToken<Tokens> extends TokenIdent<"cascade" | "restrict">
			? DbDialectOnlyError<Db, "pg-drop-cascade"> extends infer OnlyErr extends DbtyperErrorShape
				? SkipFailedStatement<Tokens, Db, OnlyErr>
				: SkipToken<Tokens> extends infer R extends ParserMonad
					? PeekToken<R> extends TokenKey<";"> | TokenEot
						? DropTargets<R, Db, K, IfExists, Names>
						: SkipFailedStatement<R, Db, DropKinds[K]["end"]>
					: never
			: PeekToken<Tokens> extends TokenKey<";"> | TokenEot
				? DropTargets<Tokens, Db, K, IfExists, Names>
				: SkipFailedStatement<Tokens, Db, DropKinds[K][Tail]>

/** Looks every name up and removes it; `Tokens` is at the `;` or the end. */
type DropTargets<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	K extends DropKind,
	IfExists extends boolean,
	Names extends readonly DropName[],
> = Names extends readonly [
	readonly [infer Sch extends string, infer Name extends string],
	...infer Rest extends readonly DropName[],
]
	? DropTarget<Db, K, IfExists, Sch, Name> extends infer Res
		? Res extends JsqlDatabaseShape
			? DropTargets<Tokens, Res, K, IfExists, Rest>
			: Res extends DbtyperErrorShape
				? SkipFailedStatement<Tokens, Db, Res>
				: never
		: never
	: [SkipToken<Tokens>, Db, null]

/** The database without the named object, or the error. */
type DropTarget<
	Db extends JsqlDatabaseShape,
	K extends DropKind,
	IfExists extends boolean,
	Sch extends string,
	Name extends string,
> = K extends "type" | "domain"
	? JsqlDbGetType<Db, Sch, Name> extends infer T extends JsqlTypeShape
		? [K, T] extends ["domain", { kind: "domain" }] | ["type", JsqlTypeShape]
			? JsqlDbReplaceType<Db, Sch, Name, null>
			: DropKinds[K]["wrongKind"]
		: IfExists extends true
			? Db
			: DropKinds[K]["missing"]
	: JsqlDbGetData<Db, Sch, Name> extends infer D
		? D extends JsqlDataShape<Exclude<K, "type" | "domain">>
			? JsqlDbReplaceData<Db, Sch, Name, null>
			: [D] extends [null]
				? IfExists extends true
					? Db
					: DropKinds[K]["missing"]
				: DropKinds[K]["wrongKind"]
		: never
